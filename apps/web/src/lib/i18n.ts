import { ar as arLocale } from 'date-fns/locale';

/**
 * Interface language follows the founder's language. Arabic founders get a full right-to-left
 * interface in Egyptian Arabic; English founders get English left-to-right.
 * Keys are the English strings, so a missing translation falls back to readable English.
 */
export type Lang = 'en' | 'ar';

let current: Lang = 'en';

export function applyLanguage(lang: Lang) {
  current = lang;
  const root = document.documentElement;
  if (root.lang !== lang) root.lang = lang;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  if (root.dir !== dir) root.dir = dir;
}

export const lang = () => current;
export const isRtlUi = () => current === 'ar';
/** Side panels open from the reading end: right in LTR, left in RTL. */
export const endSide = (): 'left' | 'right' => (current === 'ar' ? 'left' : 'right');
export const startSide = (): 'left' | 'right' => (current === 'ar' ? 'right' : 'left');
/** Dates and numbers keep Western digits in both languages (what founders type and read in tech work). */
export const locale = () => (current === 'ar' ? 'ar-EG-u-nu-latn' : undefined);
export const dateFnsLocale = () => (current === 'ar' ? arLocale : undefined);

export function t(text: string, vars?: Record<string, string | number>): string {
  // Arabic singular forms ("واحد شغال", not "1 شغالين") live under "<key>#one".
  const key = current === 'ar' && vars?.n === 1 && AR[`${text}#one`] ? `${text}#one` : text;
  let out = current === 'ar' ? (AR[key] ?? text) : text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

/**
 * Activity lines and notification titles are written by the server in English.
 * In the Arabic UI they are translated by pattern; agent-written progress (already in the
 * founder's language) passes through untouched.
 */
const ACTIVITY_RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Working · (.+) · (low|medium|high|xhigh)$/i, (m) => `شغال · ${m[1]} · ${t(m[2].charAt(0).toUpperCase() + m[2].slice(1).replace('high', 'High').replace('Xhigh', 'XHigh'))}`],
  [/^(.+) finished: (.*)$/, (m) => `${m[1]} خلص: ${m[2]}`],
  [/^(.+) stopped: (.*)$/, (m) => `${m[1]} وقف: ${m[2]}`],
  [/^(.+) failed: (.*)$/, (m) => `${m[1]} فشل: ${m[2]}`],
  [/^(.+) couldn’t fully finish: (.*)$/, (m) => `${m[1]} مقدرش يخلّص كله: ${m[2]}`],
  [/^(.+) needs your OK in Chrome$/, (m) => `${m[1]} مستني موافقتك في كروم`],
  [/^(.+) can’t reach your Chrome$/, (m) => `${m[1]} مش قادر يوصل لكرومك`],
];
const ACTIVITY_PREFIX: [string, string][] = [
  ['Result verified — ', 'النتيجة اتراجعت — '],
  ['Incomplete — ', 'ناقص — '],
  ['Needs the founder — ', 'محتاجك — '],
  ['Failed — ', 'فشل — '],
  ['Searching “', 'بيدوّر على “'],
  ['Looking for “', 'بيدوّر على “'],
  ['Searching files', 'بيدوّر في الملفات'],
  ['Reading the page', 'بيقرا الصفحة'],
  ['Opening a tab in your Chrome', 'بيفتح تاب في كرومك'],
  ['Closing its tab', 'بيقفل التاب بتاعه'],
  ['Working in your Chrome', 'شغال في كرومك'],
  ['Filling a form', 'بيملا فورم'],
  ['Uploading a file', 'بيرفع ملف'],
  ['Inspecting the page', 'بيفحص الصفحة'],
  ['Browsing ', 'بيتصفح '],
  ['Reading ', 'بيقرا '],
  ['Writing ', 'بيكتب '],
  ['Editing files', 'بيعدّل ملفات'],
  ['Editing ', 'بيعدّل '],
  ['Running Python', 'بيشغّل بايثون'],
  ['Running tests', 'بيشغّل الاختبارات'],
  ['Running ', 'بيشغّل '],
  ['Checking Git', 'بيراجع Git'],
  ['Committing changes', 'بيعمل commit'],
  ['Installing dependencies', 'بيثبّت المكتبات'],
  ['Delegating a sub-task', 'بيوزّع مهمة فرعية'],
  ['Preparing instructions', 'بيجهز التعليمات'],
  ['Applying feedback', 'بيطبّق الملاحظات'],
  ['Resuming after a restart', 'بيكمّل بعد إعادة التشغيل'],
  ['Checking the result', 'بيراجع النتيجة'],
  ['Waiting for your OK in Chrome', 'مستني موافقتك في كروم'],
  ['Chrome isn’t connected', 'كروم مش متوصل'],
  ['Run failed', 'التشغيل فشل'],
  ['Paused by founder', 'وقّفته مؤقتًا'],
  ['Stopped by founder', 'وقّفته'],
  ['Blocked: ', 'اتمنع: '],
  ['Asked the founder: ', 'سألك: '],
  ['Added a section to ', 'ضاف قسم في '],
  ['Created page ', 'عملت صفحة '],
  ['Updated page ', 'حدّثت صفحة '],
  ['Created ', 'عمل '],
  ['Saved ', 'حفظ '],
  ['Updated ', 'حدّث '],
  ['Prepared a plan for you to confirm', 'جهزت خطة تأكدها'],
  ['Started ', 'شغّلت '],
  ['Updated today', 'حدّثت النهارده'],
  ['Saved to memory', 'حفظت في الذاكرة'],
  ['Scheduled ', 'جدولت '],
];

export function trActivity(label: string): string {
  if (current !== 'ar' || !label) return label;
  for (const [re, fn] of ACTIVITY_RULES) {
    const m = label.match(re);
    if (m) return fn(m);
  }
  for (const [en, ar] of ACTIVITY_PREFIX) if (label.startsWith(en)) return ar + label.slice(en.length);
  return label;
}

/** Fixed labels the prompt compiler writes in English (context sources, tools, engineer note). */
const PROMPT_RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Focus: (.+)$/, (m) => `المجال: ${m[1]}`],
  [/^Collection "(.+)" \((\d+) records\)$/, (m) => `مجموعة "${m[1]}" (${m[2]} سجل)`],
  [/^Optimized by (.+)$/, (m) => `اتظبطت بواسطة ${m[1]}`],
];

export function trPrompt(text: string): string {
  if (current !== 'ar' || !text) return text;
  for (const [re, fn] of PROMPT_RULES) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return t(text);
}

const AR: Record<string, string> = {
  // Shell
  'just now': 'دلوقتي',
  Home: 'الرئيسية',
  'Your areas': 'مجالاتك',
  Outputs: 'الملفات',
  Settings: 'الإعدادات',
  'Search or ask Noor': 'دوّر أو اسأل نور',
  'Toggle theme': 'تغيير المظهر',
  Notifications: 'الإشعارات',
  'Nothing yet. You’ll hear about decisions, finished work and anything that needs you.': 'مفيش حاجة لسه. هتوصلك القرارات والشغل اللي خلص وأي حاجة محتاجاك.',
  Menu: 'القائمة',
  Navigation: 'التنقل',
  'Ask Noor': 'اسأل نور',
  Noor: 'نور',
  'Chief of staff': 'مديرة شغلك',
  'working…': 'شغالة…',
  'Close Noor': 'اقفل نور',
  'Resize panel': 'تغيير عرض اللوحة',
  'Drag to resize · double-click to reset': 'اسحب لتغيير العرض · دبل كليك للرجوع',
  Close: 'إغلاق',

  // Noor
  'Tell Noor what’s going on.': 'احكي لنور إيه اللي حاصل.',
  'Work, clients, content, learning, life — say it the way you’d say it to a friend. She’ll organize it and get the right people working.':
    'شغل، عملاء، محتوى، تعلم، حياة — قولها زي ما بتحكي لصاحبك. هي هترتبها وتشغّل الناس الصح.',
  Thinking: 'بتفكر',
  Decide: 'قرّر',
  Decided: 'اتقرر',
  'Message Noor': 'اكتب لنور',
  'Enter to send · Shift+Enter for a new line': 'Enter للإرسال · Shift+Enter لسطر جديد',
  Stop: 'وقّف',
  Send: 'ابعت',

  // Plan card
  'Main focus': 'الأولوية',
  Supporting: 'داعم',
  Continuous: 'مستمر',
  Goal: 'هدف',
  Idea: 'فكرة',
  Experiment: 'تجربة',
  Priority: 'الأولوية',
  'Starts working on': 'هيبدأوا شغل على',
  'Your part today': 'المطلوب منك النهارده',
  'Confirm and start': 'تمام، ابدأ',
  Adjust: 'عدّل',
  'What should change?': 'عايز تغير إيه؟',
  'Send to Noor': 'ابعت لنور',
  Cancel: 'إلغاء',
  Confirmed: 'اتأكد',
  'Replaced by a newer plan': 'اتبدلت بخطة أحدث',
  'Sent back for changes': 'رجعت للتعديل',

  // Status
  Queued: 'في الدور',
  Working: 'شغال',
  Waiting: 'مستني',
  Done: 'خلص',
  Idle: 'فاضي',
  Failed: 'فشل',
  Stopped: 'متوقف',
  Verified: 'اتراجع',
  Incomplete: 'ناقص',
  'Needs you': 'محتاجك',

  // Effort / providers
  Low: 'منخفض',
  Medium: 'متوسط',
  High: 'عالي',
  XHigh: 'عالي جدًا',
  Auto: 'تلقائي',
  Default: 'الافتراضي',
  'Default model': 'الموديل الافتراضي',
  'Effort · {e}': 'المجهود · {e}',
  'Effort: {e}': 'المجهود: {e}',

  // Home
  'Tell Noor what you need…': 'قول لنور محتاج إيه…',
  Today: 'النهارده',
  '{n} left': 'فاضل {n}',
  'Nothing on your plate yet': 'مفيش حاجة عليك لسه',
  'Noor fills this with only what you personally need to do.': 'نور بتحط هنا بس الحاجات اللي لازم تعملها بنفسك.',
  'Plan my day': 'رتّب يومي',
  Team: 'الفريق',
  '{n} working': '{n} شغالين',
  '{n} working#one': 'واحد شغال',
  '{n} working now': '{n} شغالين دلوقتي',
  '{n} working now#one': 'واحد شغال دلوقتي',
  '{n} done this week': '{n} مهام خلصت الأسبوع ده',
  '{n} done this week#one': 'مهمة خلصت الأسبوع ده',
  '{n} new file': 'ملف جديد',
  '{n} new files': '{n} ملفات جديدة',
  'No one is working yet': 'مفيش حد شغال لسه',
  'Tell Noor what you need. She brings in specialists — researchers, writers, engineers — only when they help.':
    'قول لنور محتاج إيه. هي بتجيب المتخصصين — باحثين، كتّاب، مهندسين — لما يكونوا مفيدين بس.',
  'Talk to Noor': 'كلّم نور',
  Focuses: 'المجالات',
  '{n} done': '{n} مهام خلصت',
  '{n} done#one': 'مهمة خلصت',
  '{n} output': 'ملف واحد',
  '{n} outputs': '{n} ملفات',
  'Getting started': 'لسه بنبدأ',
  'No focuses yet': 'مفيش مجالات لسه',
  'Once you and Noor agree on what matters, each area gets its own page here.': 'لما تتفق مع نور على المهم، كل مجال هيبقى له صفحة هنا.',
  'Nothing needs you right now.': 'مفيش حاجة محتاجاك دلوقتي.',
  'Recent outputs': 'آخر الملفات',
  'All outputs': 'كل الملفات',
  'No files yet': 'مفيش ملفات لسه',
  'Spreadsheets, scripts, decks and documents your team produces land here.': 'الشيتات والسكريبتات والعروض والمستندات اللي فريقك بيعملها بتنزل هنا.',
  Progress: 'التقدم',
  'last 14 days': 'آخر 14 يوم',
  'Tasks done': 'مهام خلصت',
  'Shows real completed work and outputs as they happen — nothing to chart yet.': 'هنا بيظهر الشغل اللي خلص فعلًا والملفات أول بأول — لسه مفيش حاجة.',

  // Pages
  'Change this page': 'عدّل الصفحة',
  'On the {title} page, ': 'في صفحة {title}، ',
  'This page doesn’t exist anymore.': 'الصفحة دي مش موجودة.',
  'Plan my day prompt': 'رتبلي يومي النهارده',
  'I want to add a new focus: ': 'عايز أضيف مجال جديد: ',

  // Registry sections
  Activity: 'النشاط',
  'Needs you section': 'محتاجك',
  'No specialists on this yet. Noor brings them in when they help.': 'مفيش متخصصين هنا لسه. نور بتجيبهم لما يكونوا مفيدين.',
  'Activity shows up here while agents work.': 'النشاط بيظهر هنا وهما شغالين.',
  'Nothing needs you here.': 'مفيش حاجة محتاجاك هنا.',
  'Files your team produces for this area show up here.': 'الملفات اللي الفريق بيعملها للمجال ده بتظهر هنا.',
  'No data points yet.': 'مفيش بيانات لسه.',
  'Nothing to chart yet.': 'مفيش حاجة تترسم لسه.',
  'No items in this pipeline yet.': 'مفيش عناصر هنا لسه.',
  'Loading…': 'بيحمّل…',
  'No rows yet — they appear as your team works.': 'مفيش صفوف لسه — هتظهر وفريقك شغال.',
  Search: 'بحث',
  '{label}: all': '{label}: الكل',
  'Cards appear here as work comes in.': 'الكروت هتظهر هنا مع الشغل.',
  Empty: 'فاضي',
  'Nothing here yet.': 'مفيش حاجة هنا لسه.',
  'Nothing on the timeline yet.': 'مفيش حاجة على الخط الزمني لسه.',
  Previous: 'السابق',
  Next: 'التالي',
  Details: 'التفاصيل',
  Record: 'عنصر',
  'This {type} section couldn’t render.': 'القسم ده ({type}) معرفش يظهر.',
  'No data yet': 'مفيش بيانات لسه',
  'Previous page': 'الصفحة السابقة',
  'Next page': 'الصفحة التالية',

  // Agent drawer
  Task: 'المهمة',
  'Result check': 'مراجعة النتيجة',
  'Live activity': 'النشاط المباشر',
  "{name}'s summary": 'ملخص {name}',
  'Provider, model and effort': 'المزوّد والموديل والمجهود',
  'Earlier tasks': 'مهام سابقة',
  Provider: 'المزوّد',
  Model: 'الموديل',
  Effort: 'المجهود',
  'Saved — applies to the next run': 'اتحفظ — هيتطبق على التشغيل الجاي',
  'No activity yet.': 'مفيش نشاط لسه.',
  'Starting…': 'بيبدأ…',
  'View effective prompt': 'شوف التعليمات الفعلية',
  Pause: 'إيقاف مؤقت',
  Paused: 'اتوقف مؤقتًا',
  Resume: 'كمّل',
  Resumed: 'رجع يشتغل',
  'Run again': 'شغّل تاني',
  'Running again': 'بيشتغل تاني',
  'Queued — starts when a slot frees up': 'في الدور — هيبدأ أول ما يفضى مكان',

  // Prompt inspector
  'Effective prompt': 'التعليمات الفعلية',
  'Exactly what the agent received for attempt {n}.': 'ده بالظبط اللي الإيجنت استلمه في المحاولة {n}.',
  'The prompt is still being prepared.': 'التعليمات لسه بتتجهز.',
  Role: 'الدور',
  'Context sources ({n})': 'مصادر السياق ({n})',
  'Allowed tools': 'الأدوات المسموحة',
  'Expected output': 'المطلوب تسليمه',
  'Success criteria (the judge checks these)': 'معايير النجاح (المراجع بيتأكد منها)',
  'Task prompt': 'تعليمات المهمة',
  'Operating rules': 'قواعد الشغل',
  Copy: 'نسخ',
  'Prompt copied': 'اتنسخت',
  Founder: 'المؤسس',
  Focus: 'المجال',
  Memory: 'الذاكرة',
  Records: 'السجلات',
  'Past approach': 'طريقة نجحت قبل كده',
  Project: 'المشروع',
  'Earlier attempt': 'محاولة سابقة',
  Decision: 'قرار',

  // Output drawer
  Open: 'افتح',
  Download: 'تنزيل',
  'Show in folder': 'افتح المجلد',
  by: 'بواسطة',
  'This file was moved or deleted on disk.': 'الملف ده اتنقل أو اتمسح من الجهاز.',
  '{n} rows': '{n} صف',
  '{n} rows#one': 'صف واحد',
  'showing first {n}': 'معروض أول {n}',
  'No preview for {type} files. Open it to view.': 'مفيش معاينة لملفات {type}. افتحه عشان تشوفه.',
  Image: 'صورة',
  Code: 'كود',
  File: 'ملف',
  Diff: 'تغييرات',

  // Decisions
  Recommendation: 'الترشيح',
  Why: 'ليه',
  'Add a note (optional)': 'ضيف ملاحظة (اختياري)',
  OK: 'تمام',
  Sent: 'اتبعت',
  'Decided: {choice}': 'اتقرر: {choice}',
  'Asked by {name}': 'سأل: {name}',
  Approve: 'موافق',
  Decline: 'رفض',

  // Outputs page
  'Every file your team has produced, newest first.': 'كل الملفات اللي فريقك عملها، الأحدث الأول.',
  'Find a file': 'دوّر على ملف',
  All: 'الكل',
  Sheets: 'شيتات',
  Docs: 'مستندات',
  Decks: 'عروض',
  Images: 'صور',
  Grid: 'شبكة',
  List: 'قائمة',
  'No files match': 'مفيش ملفات مطابقة',
  'Spreadsheets, scripts, decks and documents your agents produce appear here — and on the page they belong to.':
    'الشيتات والسكريبتات والعروض والمستندات اللي الإيجنتس بيعملوها بتظهر هنا — وفي الصفحة بتاعتها.',

  // Command palette
  'Command palette': 'لوحة الأوامر',
  'Search Opervio or ask Noor': 'دوّر في Opervio أو اسأل نور',
  'Ask Noor, open a page, find an output…': 'اسأل نور، افتح صفحة، دوّر على ملف…',
  'Nothing found. Press Enter on “Ask Noor” to ask her instead.': 'مفيش نتايج. دوس Enter على "اسأل نور" تسألها بدل كده.',
  'Ask Noor: “{q}”': 'اسأل نور: "{q}"',
  'Create a new focus': 'ضيف مجال جديد',
  'Go to': 'روح لـ',
  Agents: 'الإيجنتس',
  Preferences: 'التفضيلات',
  'Toggle light / dark': 'فاتح / غامق',
  'Search memory': 'دوّر في الذاكرة',

  // Tool families, memory kinds
  Web: 'الويب',
  Files: 'الملفات',
  Terminal: 'الطرفية',
  fact: 'حقيقة',
  preference: 'تفضيل',
  decision: 'قرار',
  context: 'سياق',
  note: 'ملاحظة',
  approach: 'طريقة',

  // Settings
  Profile: 'الملف الشخصي',
  AI: 'الذكاء الاصطناعي',
  Tools: 'الأدوات',
  Routines: 'الروتين',
  Name: 'الاسم',
  Language: 'اللغة',
  'Noor talks to you in this language.': 'نور بتكلمك باللغة دي، والواجهة كمان.',
  'What you do': 'بتشتغل في إيه',
  'Realistic time': 'وقتك الفعلي',
  'What you can actually give per day or week.': 'الوقت اللي تقدر تديه فعلًا في اليوم أو الأسبوع.',
  'How Noor talks': 'نور تكلمك إزاي',
  Short: 'قصير',
  Natural: 'طبيعي',
  Detailed: 'بتفاصيل',
  Autonomy: 'الاستقلالية',
  'How much the team runs on its own.': 'الفريق يشتغل لوحده قد إيه.',
  'Check with me more': 'ارجعلي أكتر',
  Balanced: 'متوازن',
  'Run with it': 'اشتغلوا براحتكم',
  'Always ask me before': 'ارجعلي دايمًا قبل',
  'Everything else is normal work and never needs approval.': 'أي حاجة تانية شغل عادي ومش محتاجة موافقة.',
  'Spending money': 'صرف فلوس',
  'Sending messages in my name': 'إرسال رسايل باسمي',
  'Publishing anything publicly': 'نشر أي حاجة للعامة',
  'Deleting files or data': 'مسح ملفات أو بيانات',
  'Production deploys or changes': 'تعديلات على production',
  'Commitments to clients or partners': 'أي التزام مع عملاء أو شركاء',
  Links: 'اللينكات',
  'Public profiles your team can learn from.': 'حساباتك العامة اللي الفريق يقدر يتعلم منها.',
  Website: 'الموقع',
  'Social profile': 'حساب سوشيال',
  Timezone: 'المنطقة الزمنية',
  Appearance: 'المظهر',
  'Match system': 'زي الجهاز',
  Light: 'فاتح',
  Dark: 'غامق',
  'Save profile': 'احفظ',
  'Profile saved': 'اتحفظ',
  Saved: 'اتحفظ',
  Providers: 'المزوّدين',
  'Opervio drives the CLIs you are already signed in to.': 'Opervio بيشغّل أدوات سطر الأوامر اللي إنت مسجل فيها.',
  'Version {v}': 'الإصدار {v}',
  'Not found': 'مش موجود',
  'Effort: {list}': 'المجهود: {list}',
  'Check again': 'افحص تاني',
  'Your main AI — conversation and planning.': 'الذكاء الأساسي — كلام وتخطيط.',
  Specialists: 'المتخصصين',
  'Research, writing, content, analysis.': 'بحث، كتابة، محتوى، تحليل.',
  Coding: 'البرمجة',
  'Software work in your projects.': 'شغل البرمجة في مشاريعك.',
  'Prompt Engineer': 'مهندس التعليمات',
  'Sharpens each task prompt. Fast and cheap.': 'بيظبط تعليمات كل مهمة. سريع ورخيص.',
  'Result Judge': 'مراجع النتايج',
  'Checks outcomes before anything is called done.': 'بيراجع النتيجة قبل ما أي حاجة تتحسب خلصت.',
  'Agents at once': 'إيجنتس في نفس الوقت',
  'How many specialists can work in parallel.': 'كام متخصص يشتغلوا مع بعض.',
  'Correction rounds': 'جولات التصحيح',
  'If the judge finds work incomplete, the same agent gets focused feedback this many times.': 'لو المراجع لقى الشغل ناقص، نفس الإيجنت ياخد ملاحظات محددة العدد ده من المرات.',
  Browser: 'المتصفح',
  'Where agents browse the web for you.': 'الإيجنتس بيتصفحوا النت فين.',
  'Your Chrome': 'كروم بتاعك',
  'Agents work in the Chrome you already use — your tabs and sign-ins — through the Claude in Chrome extension. They open their own tabs and leave yours alone.':
    'الإيجنتس بيشتغلوا في كروم اللي بتستخدمه — تابات وحساباتك — من خلال إضافة Claude in Chrome. بيفتحوا تابات خاصة بيهم ومبيلمسوش تاباتك.',
  'Separate window': 'نافذة منفصلة',
  'Agents use their own isolated browser window, without access to your tabs or sessions.': 'الإيجنتس بيستخدموا نافذة منفصلة من غير وصول لتاباتك أو حساباتك.',
  'Keep Chrome open with the Claude in Chrome extension signed in. The first time an agent acts on a site, Chrome asks you to approve it — Opervio notifies you when an agent is waiting. Browser tasks run on Claude, since Codex can’t drive your Chrome.':
    'خلي كروم مفتوح وإضافة Claude in Chrome متسجلة. أول مرة إيجنت يشتغل على موقع، كروم هيطلب موافقتك — وOpervio هيبلغك لما إيجنت يكون مستني. مهام المتصفح بتشتغل على Claude لأن Codex ميقدرش يتحكم في كرومك.',
  'Show the window while agents work': 'اعرض النافذة وهما شغالين',
  Python: 'بايثون',
  'An isolated environment agents use for data, spreadsheets, documents and charts.': 'بيئة منفصلة الإيجنتس بيستخدموها للبيانات والشيتات والمستندات والرسوم.',
  'Python not found': 'بايثون مش موجود',
  'environment ready': 'البيئة جاهزة',
  'environment not created': 'البيئة مش متعملة',
  'Repair / update': 'إصلاح / تحديث',
  'Set up environment': 'جهّز البيئة',
  'Installing Python packages in the background…': 'بيثبّت مكتبات بايثون في الخلفية…',
  Git: 'Git',
  'Git not found': 'Git مش موجود',
  Workspace: 'مساحة الشغل',
  'Where agents keep their working files and deliverables.': 'مكان ملفات شغل الإيجنتس وتسليماتهم.',
  'No routines yet. Ask Noor for things like a daily plan or a weekly content review.': 'مفيش روتين لسه. اطلب من نور حاجة زي خطة يومية أو مراجعة محتوى أسبوعية.',
  Reminder: 'تذكير',
  'Agent task': 'مهمة إيجنت',
  'next {when}': 'الجاي {when}',
  'Delete routine': 'امسح الروتين',
  'Nothing matches.': 'مفيش حاجة مطابقة.',
  'Noor and the team save durable facts and preferences here as you work together.': 'نور والفريق بيحفظوا هنا الحقائق والتفضيلات المهمة وإنتوا شغالين مع بعض.',
  Forget: 'انسى',
  '{n}m': '{n} د',
  // Prompt compiler labels
  'Relevant memory': 'ذاكرة ليها علاقة',
  'Approaches that worked before': 'طرق نجحت قبل كده',
  'Existing outputs': 'ملفات موجودة',
  'Project state': 'حالة المشروع',
  'Previous attempts': 'محاولات سابقة',
  'Who the work is for': 'الشغل ده لمين',
  'The area this task serves': 'المجال اللي المهمة دي بتخدمه',
  'Matched this task by search; dates show freshness': 'طلعت بالبحث عن المهمة دي؛ التواريخ بتوضح هي جديدة قد إيه',
  'Previous successful approach for similar work': 'طريقة نجحت قبل كده في شغل شبه ده',
  'Earlier deliverables in this area — build on them, do not duplicate': 'تسليمات سابقة في المجال ده — يكمّل عليها وما يكررهاش',
  'Existing structured data — update it instead of starting over': 'بيانات منظمة موجودة — يحدّثها بدل ما يبدأ من الأول',
  'Current repository state — inspect before editing, never destroy unrelated work': 'حالة الريبو دلوقتي — يبص قبل ما يعدّل، وما يبوظش أي شغل مالوش علاقة',
  'Do not repeat what failed': 'ما يكررش اللي فشل',
  'Web search & fetch': 'بحث وقراءة الويب',
  'The founder’s own Chrome (Claude in Chrome)': 'كروم بتاعك (Claude in Chrome)',
  'Browser (separate window)': 'متصفح (نافذة منفصلة)',
  'Files & terminal': 'الملفات والتيرمينال',
  'Prompt Engineer unavailable — using the compiled skeleton': 'مهندس التعليمات مش متاح — بنستخدم الهيكل الأساسي',
};
