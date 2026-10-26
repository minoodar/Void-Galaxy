/* ======================================================================
   Void Tab — Music Mode · ویژولایزر (فاز ۲)

   سه مرحله، با حداقلِ پردازش:
     Stage 0  (مکث/ورود)      هیچ حلقه‌ای نمی‌چرخد؛ بوم پاک است.
     Stage 1  (پخش، آرام)     شفقِ آبی روی یک بافتِ ¼-رزولوشن، ~۲۰fps، فقط آنالیزرِ انرژی.
     Stage 2  (اوج)           کهکشانِ زاویهٔ طلایی + سیاه‌چاله؛ ۳۰fps؛ آنالیزرِ طیف + کروما.

   اصل: «کهکشان را متحرک نمی‌کنیم، روشنش می‌کنیم.» هندسه یک بار ساخته می‌شود
   (typed array → GPU)، و هر فریم فقط ~۴۰ عدد uniform آپلود می‌شود.
   هر نقطه یک LED است: رنگش از «کلاسِ نت»ش (۱۲ کلاس، نمایشِ ۷ خانوادهٔ رنگی)،
   و روشن/خاموش‌شدنش یک hash قطعی از (نقطه، زمانِ گسسته) است. هیچ ذره‌ای ساخته/نابود نمی‌شود.

   تازگیِ بی‌تکرار: هر نشست هندسهٔ تازه (seed تصادفی)، هر آهنگ شیب/فازِ مارپیچ/شفقِ تازه.

   روایتِ دوربین: بیشترِ چرخه، حرکتِ آرامِ «لبه‌ای → دیدِ بالا» است. در پایانِ هر چرخه
   یک «رویدادِ تونل» می‌آید: حلقه‌های بی‌نهایت از نزدیکِ افق می‌زایند، بزرگ می‌شوند،
   از کادر بیرون می‌روند و بعد همان حرکت معکوس می‌شود. هیچ سیاهیِ تمام‌صفحه‌ای وجود
   ندارد؛ حلقه‌های رنگی و مارپیچی و فورانِ ستارگان اصلِ ماجرایند. زمان‌بندی در DIVE است.

   منابع: سه پلهٔ کیفیت (نقاط/رزولوشن/نرخِ شفق) + مقیاسِ رندرِ پویا + شفقِ زمانی +
   scissor افق؛ مدیرِ کیفیت با fps/CPU و هیسترزیس جابه‌جا می‌شود تا افکت روان بماند.
   پلهٔ اولیه از دستگاه (موبایل/هسته/حافظه) و تنظیمِ «کیفیت تصویر» تعیین می‌شود.
   ====================================================================== */
(function () {
  'use strict';
  if (window.VoidMusicViz) return;
  const VM = window.VoidMusic;
  if (!VM) return;

  const TAU = Math.PI * 2;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));            // ۱۳۷٫۵۰۷۷۶۴°
  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const CFG = {
    calmFps: 20, galaxyFps: 30, reducedFps: 12,
    dotsDesktop: 22000, dotsMobile: 8500,
    // HOTFIX «موزیکِ تب پخش می‌شود؟» باورپذیر باشد: 'or' = reported-playing **یا** audio trackی که
    // readyState‌اش 'live' است؛ `track.muted` هرگز سیگنالِ توقف نیست (تبِ capture‌شدهٔ بی‌صدای مرورگر
    // muted گزارش می‌کند در حالی که پخش ادامه دارد → کهکشان تاریک می‌شد). 'legacy' = قاعدهٔ سختِ Phase 1
    // (stream باید live و بی‌صدا نباشد). یک‌خط برگشت: همین‌جا 'legacy'.
    webPlayRule: 'or', playHoldMs: 1700,     // playHoldMs: خوانشِ بدِ کوتاه، پخش را نبندد (هیسترزیس)
    // §AMBIENT لایه‌های پخش: 'ambient' = اگر دادهٔ صوتیِ واقعی نداریم ولی تب *تازه* می‌گوید پخش
    // می‌کند، کهکشان با انرژیِ تزئینی زنده می‌ماند (هرگز تاریک نیست)؛ 'off' = رفتارِ پیش از این
    // تغییر (تاریکیِ مجاز). یک‌خط برگشت: همین‌جا 'off'.
    // webFreshMs: پنجرهٔ تازگیِ گزارشِ تب. قاعدهٔ dedupe در void-media-hook.js هر ~۵ ثانیه یک
    // گزارش می‌فرستد (Math.floor(pos/5) + تیکِ ۱ ثانیه) و هر vm-web-ping هم report(true) را
    // بی‌درنگ می‌زند (void-media-hook.js:174)، پس «۸ ثانیه بی‌خبر» یعنی دو گزارشِ از دست رفته =
    // دیگر باور نمی‌کنیم — نه بیشتر، تا تبِ مرده کهکشان را روشن نگه دارد.
    webFallback: 'ambient', webFreshMs: 8000, tierXFadeS: 0.7,
    // §SHOW نمایشِ آرایشیِ لایهٔ ambient. این یک «کارگردانِ» زمان‌محور است، نه تحلیلِ موسیقی:
    // هیچ ضربان/تمپو/اوجِ موسیقی‌ای را ادعا نمی‌کند و هیچ‌جا quality را از 'ambient' بیرون نمی‌آورد.
    // ambientShow=false = دقیقاً همان ambientِ امروز (هیچ چیز از این بلوک اجرا نمی‌شود).
    // ambientShowLevel (۰..۱) شدتِ کلِ نمایشِ آرایشی است (پرتوِ روشنایی، رنگ، flare).
    ambientShow: true, ambientShowLevel: 0.8,
    // §IDLE «حالتِ سکوتِ تکین» (Singularity Idle Mode): تبی که *صدا* دارد ولی منبعِ موسیقیِ
    // معتبرِ کهکشان نیست (اتاقِ صوتی/کالان — خودِ لایهٔ منبع آن را با activeInfo.audioOnly اعلام
    // می‌کند؛ ما «صدا» را با «موسیقی» یکی نمی‌گیریم). در این حالت کهکشان، ستاره‌ها، شفق، ذرات و
    // تحلیلِ صدا خاموش می‌مانند و فقط همان هالهٔ همیشگیِ پشتِ کرهٔ سیاه (همان FS_HORIZON که با
    // uTime=V.haloT می‌چرخد) آرام حرکت می‌کند؛ عنوانِ تب هم همان‌طور که بود می‌ماند.
    // ورود/خروج با همان blend نرم است (هیچ پرش و هیچ سیاهی‌ای ندارد) و خروجِ کامل از حالت،
    // همان رفتارِ قبلی است: فریمِ کم‌نورِ فریزشده.
    // یک‌خط برگشت: idleHalo = false ⇒ هیچ چیز از این حالت اجرا نمی‌شود و صفحه دقیقاً مثلِ دیروز است.
    idleHalo: true, idleHaloLevel: 0.30, idleHaloFadeS: 0.9,
    // §SCENE مدلِ سه‌حالتهٔ «تکینِ افسون‌شده ← بیداریِ کهکشانی ← کهکشانِ زنده»:
    //   idle    = هیچ منبعی نیست (یا منبعِ فقط-صدا) ⇒ همان هالهٔ زندهٔ بالا، با هیچ‌چیزِ دیگر.
    //             سطحش را با idleHaloLevelِ دست‌نخورده می‌گیریم: هاله‌ای که قبلاً بازبینی شده،
    //             پس در idleِ بی‌منبع هم همان نقره‌ای-بنفشِ آرام است و عددِ تازه‌ای اضافه نشده.
    //   source  = منبع تشخیص داده شده ولی پخش تأیید نشده ⇒ قرصِ تجمع از ردِ کم‌نورِ holeRest
    //             تا awakenLevel بیدار می‌شود (uRevealِ حلقه‌ها از همان Lg می‌آید؛ هیچ لایهٔ
    //             تازه‌ای نیست). هیچ عددِ صوتیِ ساختگی نمایش داده نمی‌شود: FEAT دست‌نخورده
    //             می‌ماند و quality هرگز «live» نمی‌شود — تشخیص، پخش نیست.
    //   playing = کهکشانِ کاملِ واکنش‌به‌صوت، بیت‌به‌بیت مثلِ امروز (awakenX همیشه ۰).
    // vstate فقط یک *خوانشِ مشتق* از سیگنال‌های از-پیش-موجود است (V.playing + رأیِ لایهٔ
    // منبع): نه تایمرِ تازه، نه listener تازه، نه کلیدِ storage تازه.
    // scene=false ⇒ هر دو شاخهٔ تازه خاموش‌اند و اعدادِ فریم مثلِ دیروز است.
    scene: true, awakenLevel: 0.34, awakenFadeS: 1.8,
    // §ENCHANT «هالهٔ افسونگر» + «ورودِ باشکوه» (فقط لایهٔ بصری؛ هیچ ربطی به تحلیل/پخش صدا ندارد):
    //   enchant       = در حالتِ idle (بی‌منبع یا فقط-صدا) دورِ کرهٔ سیاه یک «اژدهای خفته» می‌چرخد: پیچِ مارپیچیِ
    //                   کوچک و کم‌نورِ کهربایی-گرم (هم‌رنگِ هالهٔ افق) با پولکِ ریز و گرهِ ستاره‌ای، یک اخگرِ بسیار
    //                   کم‌نور، و غبارِ ریز؛ با شروعِ پخش نرم محو می‌شود و افکتِ اصلی جایش را می‌گیرد
    //                   (یک پاسِ شیدرِ سبکِ جدا، بعد از پاسِ افق؛ کرهٔ سیاه کدر می‌ماند). enchantLevel شدتِ آن.
    //   grandEntrance = لحظهٔ آغازِ واقعیِ پخش (پس از سکوتی ≥ entranceCooldownS) یک نمایشِ ~entranceS ثانیه‌ای:
    //                   اژدها بیدار می‌شود: نفسِ عمیق ← اخگر روشن ← دو موجِ شوک ← جریان شتاب می‌گیرد، هم‌زمان با ابزارهای موجودِ همین فایل
    //                   (V.flare / V.ejBurst / spawnBloom / awakenDistantGroups). با reduced-motion اجرا نمی‌شود.
    // یک‌خط برگشت: enchant:false و/یا grandEntrance:false ⇒ صفحه دقیقاً مثلِ قبل است.
    enchant: false, enchantLevel: 0.85,
    grandEntrance: false, entranceS: 5.0, entranceCooldownS: 20,
    // §DORMANT «کهکشانِ خفته»: در حالتِ idle (هیچ منبعی نیست) همان کرهٔ سیاه و همان کهکشانِ موجود — با نورِ بسیار کم
    //   و همان حرکتِ آرامِ همیشگی — حاضر می‌ماند؛ نه هالهٔ جدا و نه شیدر/سیستمِ تازه. سطحِ آن فقط همان عددِ سکونِ
    //   کهکشان (V.L.galaxy) است، مثلِ awakenLevel برای حالتِ «منبع هست». شروعِ پخش همان مسیرِ همیشگیِ بالا آمدنِ
    //   Lg را می‌گیرد (از این سطح، نه از صفر ⇒ بدونِ پرش). یک‌خط برگشت: idleGalaxy:false ⇒ همان هالهٔ قبلی.
    idleGalaxy: true, idleGalaxyLevel: 0.16,
    // حساسیت: انرژیِ نرمال‌شده (۰..۱) نسبت به بازهٔ پویاییِ همین آهنگ؛ sens بزرگ‌تر = زودتر و بیشتر. با HUD (Shift+D) تنظیم کن
    sens: 1.15, enterE: 0.46, enterFluxE: 0.34, enterFluxR: 1.45, exitE: 0.26,
    minGalaxyS: 1.2, exitHoldS: 1.4, enterHoldS: 0.18, cooldownS: 0.6, holeRest: 0.20, holeBase: 0.30,
    powderMinS: 8.0      // پودرِ عنوان: حداقل ۸ ثانیه، و هرگز کمتر از ۱/۲۰ طولِ آهنگ
  };
  const BREATH = {
    cyclesPerTrack: 2, minCycleS: 24, maxCycleS: 180, fallbackTrackS: 180, rollFadeS: 18,
    startPitch: 10, endPitch: 80, startZoom: 0.86, endZoom: 1.0, startRoll: 0.35, maxPitch: 88
  };
  // روایتِ دوربین (§3): یک «گشایش» در آغازِ واقعیِ پخش، سپس «خانه» = دیسکِ تمام‌گشاده که
  // ماندگارِ سفر است؛ رویدادهای تونل روی اوجِ موسیقی بلند می‌شوند و به همان کف برمی‌گردند.
  // هیچ سیاهیِ تمام‌صفحه‌ای وجود ندارد و درِ کرم‌چاله با مکث، عنوان، پودر یا اطلاعاتِ تب بسته نمی‌شود.
  //   trackShare   سهم هر رویداد از طول آهنگ (۰٫۱۰)؛ سیکل‌ها از باقی‌ماندهٔ آهنگ تقسیم می‌شوند
  //   forwardPart  سهمِ حرکت به داخل از کلِ رویداد (بقیه برگشت است)
  //   flow         «دورِ حلقه» در ثانیه در اوجِ رویداد (جریانِ محوریِ واقعیِ تونل)
  //   diveBase     کفِ عمقِ تونل در پخش: سفر پیوسته است، رویداد آن را بلند می‌کند و خاموش نمی‌کند
  //   idleShare    سهمِ حرکتِ پایه از جریان وقتی رویدادی در کار نیست (هرگز به بیت وابسته نیست)
  //   eventWaitS   بیشترین صبر برای قفل روی اوج؛ در سکوت پس از آن رویداد خودکار آغاز می‌شود
  //   camIn/camOut گذارِ نرمِ دوربین به خانه یا بیرونِ آن (عنوان و پودر در را نمی‌بندند)
  //   airMin       کمینهٔ نورِ پس‌زمینه؛ صفحه هرگز کامل سیاه نمی‌شود
  const DIVE = {
    trackShare: 0.10, minEventS: 8, maxEventS: 34,
    forwardPart: 0.65, flow: 0.13,
    tauIn: 0.35, tauOut: 0.55, pitch: 8, airMin: 0.45,
    diveBase: 0.14, idleShare: 0.30, eventWaitS: 14, camIn: 2.2, camOut: 1.8, silentGraceS: 20,
    // §B ترتیبِ دوپاس تا کفِ پخش (diveBase=۰.۱۴) باید بماند: هندسه در آن dive هنوز mix(p,pt,warp)
    // است، یعنی ۸۶٪ دیسک، ولی برشِ نیمه‌ها side=sin(th) هیچ وابستگی به warp ندارد.
    //   splitAt     جایی که تونل دیگر «دیسکِ کج» نیست و تک‌پاس به‌کار می‌آید
    //   splitSoft   پهنای پنجرهٔ نرم حولِ splitAt؛ درونِ آن برشِ نیمه‌ها به وزنِ مکمل تبدیل می‌شود
    //               (نیمهٔ دور ۱-w و نیمهٔ نزدیک w، مجموعشان ۱ ⇒ روشنایی بیرونِ کره حفظ می‌شود)
    splitAt: 0.35, splitSoft: 0.12
  };
  // آینهٔ SPAN در VS_DOTS: uTravel داخل mod(...,SPAN) می‌رود، پس برای حفظِ دقتِ float
  // روی همان یک بازهٔ متناوب نگه داشته می‌شود.
  const TUNNEL_SPAN = 1.42 - 0.13;
  // §REVEAL-RAMP مدتِ ورودِ پیوستهٔ حلقه‌ها در گذارِ tunnelMode (ثانیه). فقط uReveal را می‌سازد؛ به dive/warp وصل نیست.
  const REVEAL_RAMP_S = 2.0;
  // سه پلهٔ کیفیت: ۰ کم، ۱ متوسط، ۲ زیاد. مدیرِ کیفیت با توجه به fps/CPU بین این‌ها
  // جابه‌جا می‌شود: تعداد نقاط، بودجهٔ پیکسل (رزولوشنِ داخلی)، نرخِ به‌روزرسانیِ شفق و
  // تعداد ستاره‌های دور را کم/زیاد می‌کند. ظاهر کلی و همان افکت حفظ می‌شود.
  const QLV = [
    { q: 0.58, budget: 0.95e6, aurora: 2, band: 0.65, calm: 15 },
    { q: 0.80, budget: 1.55e6, aurora: 2, band: 0.85, calm: 18 },
    { q: 1.00, budget: 2.30e6, aurora: 1, band: 1.00, calm: 20 }
  ];
  function detectTier() {
    const cores = navigator.hardwareConcurrency || 4;
    const mobile = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || innerWidth < 700;
    let t = mobile ? 1 : 2;
    if (cores <= 4) t = Math.min(t, 1);
    if (mobile && cores <= 4) t = 0;
    if (navigator.deviceMemory && navigator.deviceMemory <= 4) t = Math.min(t, 1);
    return t;
  }
  const Q = {
    tier: 2, autoTier: 2, budget: 2.3e6, auroraEvery: 1, band: 1, calm: 20,
    scaleDirty: false, scaleCooldown: 0, tierCooldown: 0, grace: 0,
    fpsEma: 0, msEma: 0, slow: 0, fast: 0, auroraFrame: 0, lastUpAt: 0, upBlockedUntil: 0
  };
  Q.autoTier = detectTier(); Q.tier = Q.autoTier;
  const COSMIC_GROUPS = 24, COSMIC_STARS_PER_GROUP = 6;
  // راه شیری پس‌زمینه + دنباله‌دارها. همهٔ اعدادِ قابل‌تنظیم اینجاست.
  const MW = {
    base: 0.40,                       // نوردهیِ پایه: نوار همیشه کم‌نور حاضر است (هرگز صفر نمی‌شود)
    firstS: 2.0,                      // اولین «نمایان‌شدن» ۲ تا ۴ ثانیه بعد از شروع
    appearS: 8, holdS: 26, fadeS: 12, // مدت‌ها (هرکدام + بخشِ تصادفی کوچک)
    restMin: 48, restRand: 34,        // فاصلهٔ دو نمایان‌شدن (ثانیه)
    starsDesktop: 1500, starsMobile: 600,
    cometGapS: 10, cometGapRand: 12, // فاصلهٔ دو دنباله‌دار؛ بدونِ وابستگی به اوج
    cometStrength: 0.62
  };
  const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
  // §SHOW جدولِ زمان‌بندیِ «کارگردان». همهٔ بازه‌ها ثانیه‌اند و هر بار با rngِ خودِ نمایش
  // کمی جابه‌جا می‌شوند تا تکرارِ آشکار در ۶۰ ثانیه نیفتد.
  //   fotosensitivity: maxEnvPerS سقفِ سختِ تغییرِ روشنایی در ثانیه، minEventGapS فاصلهٔ دو پرش،
  //   flareRate سقفِ بالا‌رفتنِ flare (پله‌ای نیست) و flashGapS حداقلِ فاصلهٔ دو جرقه (≤۲Hz).
  //   density پله‌های کیفیت: ضریبِ فشردگیِ افکت‌ها (۰=کم‌مصرف‌ترین پله).
  const SHOW = {
    overtureS: 20, ringStepS: 0.9, ringRiseS: 2.6,
    envLo: 0.30, envHi: 1.0, maxEnvPerS: 0.42,
    surgeMinS: 60, surgeRandS: 30, surgeHoldS: 10, breathMinS: 9, breathRandS: 7,
    minEventGapS: 8, flashGapS: 0.5, flareRate: 0.8, flareMax: 0.5,
    cometMinS: 6, cometRandS: 7, bloomMinS: 9, bloomRandS: 8, wakeMinS: 11, wakeRandS: 9,
    flightMinS: 38, flightRandS: 30,
    energyGain: 0.34, energyTrim: 0.22, chromaW: 0.55, tintW: 0.42, hueMix: 0.30, huePeriodS: 46,
    density: [0.55, 0.80, 1.0]
  };


  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const expK = (dt, tau) => 1 - Math.exp(-dt / tau);
  const smoother5 = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // §SHOW hashِ FNV-1a: همان رشته ⇒ همان عدد (کروما/پالتِ آهنگ در همهٔ تب‌ها و همهٔ نشست‌ها خوانا می‌ماند)
  function hash32(str) { let h = 2166136261 >>> 0; const s = String(str || ''); for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; } return h >>> 0; }
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // پالت ثابت هفت‌رنگ؛ کلاس‌های نت بعد از رینگ هفتم سفید نگه داشته می‌شوند.
  const RAINBOW_HUES = [0, 30, 56, 125, 218, 248, 282];
  function hsl(h, s, l) {
    h /= 360; const a = s * Math.min(l, 1 - l);
    const f = function (n) { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [f(0), f(8), f(4)];
  }
  const WARM = [1.0, 0.86, 0.60];
  const PAL = new Float32Array(36);
  for (let i = 0; i < 12; i++) {
    const c = i < RAINBOW_HUES.length ? hsl(RAINBOW_HUES[i], 0.78, 0.62) : [0.88, 0.90, 0.96];
    PAL[i * 3] = c[0]; PAL[i * 3 + 1] = c[1]; PAL[i * 3 + 2] = c[2];
  }

  /* ------------------------------------------------------------------ */
  /* صدا: گراف + آنالیز                                                   */
  /* ------------------------------------------------------------------ */
  const FLUX_SEED = 0.12;   // پیش‌مقدارِ فلاکسِ بی‌بُعد (سهمِ binهای رو‌به‌رشد از کلِ طیف)
  const BAND_AGC_TARGET = -46;   // dBFS: جبرانِ کمبودِ ولوم، بلندترین باند را تا میانهٔ پنجرهٔ نگاشت بالا می‌آورد (نه به سقف)
  const A = {
    state: 'none', tries: 0, ctx: null, anE: null, anS: null, gain: null, sr: 48000,
    tBuf: null, fE: null, prevE: null, fS: null, kEHi: 0,
    kLo: 0, kHi: 0, pcIdx: null, pcW: null, bandIdx: null, kC0: 0, kC1: 0,
    raw: new Float32Array(12), band: new Float32Array(12), chroma: new Float32Array(12),
    bright: 0.2, db: -90, base: -60, warm: 4, snap: true, fluxBase: FLUX_SEED, fluxR: 1, prevFluxR: 1, centroidR: 0.4, conf: 0, energy: 0,
    silent: true, measured: 0, ok: false, pk: -30, fl: -50, en: 0, src: null,
    web: false, sink: null, gestureArmed: false, retryGo: null,
    tapped: true, bassAvg: 0, bassPrev: 0, bassBeat: false, lastBass: -9, tAcc: 0, kBass: 1,
    tapsWhy: '', trackEv: '',
    kLowEnd: 4, kMidEnd: 42, low: 0, mid: 0, high: 0,
    bassRatio: 0, bandNorm: 0, fSeed: true
  };

  /* ------------------------------------------------------------------ */
  /* تنظیمات صدا: اکولایزر ۱۰ باند + محدودکننده + حالتِ پس‌زمینه + کیفیتِ تصویر */
  /* ------------------------------------------------------------------ */
  const SND_KEY = 'voidMusic.sound';
  const EQ_HZ = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const EQ_PRESETS = {
    flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bass: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
    treble: [0, 0, 0, 0, 0, 0, 2, 4, 5, 6],
    vocal: [-2, -2, -1, 1, 3, 4, 3, 1, 0, -1],
    rock: [5, 4, 2, -1, -2, -1, 2, 4, 5, 5],
    pop: [-1, 1, 3, 4, 2, 0, -1, -1, 1, 2],
    jazz: [3, 2, 1, 2, -2, -2, 0, 1, 2, 3],
    classical: [3, 2, 1, 1, 0, 0, 0, -1, -2, -3],
    electronic: [5, 4, 1, 0, -2, 2, 1, 1, 4, 5],
    lounge: [-3, -1, 0, 1, 3, 2, 0, -1, 2, 1]
  };
  const SND = { on: true, preset: 'flat', bands: EQ_PRESETS.flat.slice(), pre: 0, auto: true, limiter: true, bg: 'audio', vq: 'auto' };
  function sndSanitize(o) {
    if (!o || typeof o !== 'object') return;
    const num = function (v, d) { v = Number(v); return isFinite(v) ? clamp(Math.round(v * 2) / 2, -12, 12) : d; };
    if ('on' in o) SND.on = !!o.on;
    if ('auto' in o) SND.auto = !!o.auto;
    if ('limiter' in o) SND.limiter = !!o.limiter;
    if ('pre' in o) SND.pre = num(o.pre, 0);
    if (Array.isArray(o.bands) && o.bands.length === 10) {
      SND.bands = o.bands.map(function (v) { return num(v, 0); });
      if (!('preset' in o)) SND.preset = 'custom';
    }
    if ('preset' in o) SND.preset = (o.preset === 'custom' || EQ_PRESETS[o.preset]) ? o.preset : 'custom';
    if (o.bg === 'audio' || o.bg === 'live') SND.bg = o.bg;
    if (o.vq === 'auto' || o.vq === 'low' || o.vq === 'high') SND.vq = o.vq;
  }
  try { const raw = localStorage.getItem(SND_KEY); if (raw) sndSanitize(JSON.parse(raw)); } catch (e) {}
  function sndSave() { try { localStorage.setItem(SND_KEY, JSON.stringify(SND)); } catch (e) {} }

  const SNDE = { nodes: null };
  function buildSoundChain(ctx, src, outGain) {
    const pre = ctx.createGain();
    const filters = EQ_HZ.map(function (hz, i) {
      const f = ctx.createBiquadFilter();
      f.type = i === 0 ? 'lowshelf' : (i === 9 ? 'highshelf' : 'peaking');
      f.frequency.value = hz; if (f.type === 'peaking') f.Q.value = 1.1; f.gain.value = 0;
      return f;
    });
    const comp = ctx.createDynamicsCompressor();
    pre.connect(filters[0]);
    for (let i = 0; i < 9; i++) filters[i].connect(filters[i + 1]);
    filters[9].connect(comp); comp.connect(outGain);
    SNDE.nodes = { ctx: ctx, src: src, pre: pre, filters: filters, comp: comp, out: outGain, mode: '', anV: null, anVon: false, tap: null, vbuf: null };
    applySound(true);
  }
  function retapSpectrum() {
    const N = SNDE.nodes; if (!N || !N.anV) return;
    if (N.tap) { try { N.tap.disconnect(N.anV); } catch (e) {} N.tap = null; }
    if (N.anVon) { N.tap = N.mode === 'fx' ? N.comp : N.src; try { N.tap.connect(N.anV); } catch (e) {} }
  }
  function applySound(immediate) {
    const N = SNDE.nodes; if (!N) return;
    const t = N.ctx.currentTime, tc = immediate ? 0.001 : 0.04;
    const maxUp = Math.max(0, Math.max.apply(null, SND.bands));
    const preDb = SND.on ? SND.pre - (SND.auto ? maxUp * 0.6 : 0) : 0;
    N.pre.gain.setTargetAtTime(Math.pow(10, preDb / 20), t, tc);
    N.filters.forEach(function (f, i) { f.gain.setTargetAtTime(SND.on ? SND.bands[i] : 0, t, tc); });
    const lim = SND.limiter;
    N.comp.threshold.setTargetAtTime(lim ? -3 : 0, t, tc); N.comp.knee.setTargetAtTime(lim ? 6 : 0, t, tc);
    N.comp.ratio.setTargetAtTime(lim ? 20 : 1, t, tc); N.comp.attack.setTargetAtTime(0.003, t, tc); N.comp.release.setTargetAtTime(0.12, t, tc);
    const mode = (SND.on || lim) ? 'fx' : 'bypass';       // هر دو خاموش ⇒ مسیرِ مستقیم (کمترین پردازش)
    if (mode !== N.mode) {
      try { N.src.disconnect(N.pre); } catch (e) {}
      try { N.src.disconnect(N.out); } catch (e) {}
      try { N.src.connect(mode === 'fx' ? N.pre : N.out); } catch (e) {}
      N.mode = mode; retapSpectrum();
    }
  }
  const SPEC_BARS = 32;
  const soundApi = {
    hz: EQ_HZ, presets: EQ_PRESETS,
    get: function () { return { on: SND.on, preset: SND.preset, bands: SND.bands.slice(), pre: SND.pre, auto: SND.auto, limiter: SND.limiter, bg: SND.bg, vq: SND.vq }; },
    set: function (patch) {
      sndSanitize(patch); sndSave(); applySound(false);
      try {
        refreshTaps(); if (document.hidden && SND.bg === 'live') bgKick();
        if (patch && typeof patch === 'object' && 'vq' in patch) syncQualityMode();
      } catch (e) {}
    },
    preset: function (name) { if (EQ_PRESETS[name]) soundApi.set({ preset: name, bands: EQ_PRESETS[name].slice() }); },
    reset: function () { soundApi.set({ on: true, preset: 'flat', bands: EQ_PRESETS.flat.slice(), pre: 0, auto: true, limiter: true }); },
    ready: function () { return !!SNDE.nodes; },
    // طیفِ زنده برای نمایشگرِ اکولایزر: فقط وقتی پنل باز است تحلیل‌گر وصل می‌شود
    watch: function (on) {
      const N = SNDE.nodes; if (!N) return;
      if (on) {
        if (!N.anV) { N.anV = N.ctx.createAnalyser(); N.anV.fftSize = 1024; N.anV.smoothingTimeConstant = 0.72; N.anV.minDecibels = -88; N.anV.maxDecibels = -20; N.vbuf = new Uint8Array(N.anV.frequencyBinCount); }
        N.anVon = true; retapSpectrum();
      } else if (N.anV) { N.anVon = false; retapSpectrum(); }
    },
    spectrum: function (out) {
      const N = SNDE.nodes; if (!N || !N.anV || !N.anVon) return false;
      N.anV.getByteFrequencyData(N.vbuf);
      const hzPerBin = N.ctx.sampleRate / N.anV.fftSize, M = out.length;
      for (let i = 0; i < M; i++) {
        const f0 = 40 * Math.pow(16000 / 40, i / M), f1 = 40 * Math.pow(16000 / 40, (i + 1) / M);
        const k0 = Math.max(1, Math.floor(f0 / hzPerBin)), k1 = Math.min(N.vbuf.length - 1, Math.max(k0, Math.ceil(f1 / hzPerBin)));
        let m = 0; for (let k = k0; k <= k1; k++) if (N.vbuf[k] > m) m = N.vbuf[k];
        out[i] = m / 255;
      }
      return true;
    }
  };

  /* ------------------------------------------------------------------
     §0 حلقهٔ خطا (diagnosis-only): هر callbackِ تایمر/فاصله/framِ این فایل با guard
     اجرا می‌شود و یک‌خطِ خلاصه (برچسب + نوع/پیام + سه قابِ نخستِ پشته) در زنجهٔ ۴۰تایی
     ثبت می‌شود؛ همان خطا دوباره پرتاب می‌شود، پس مسیرِ هیچ کدی عوض نمی‌شود و رفتارِ
     مرورگر (قطعِ زنجیره، ادامهٔ interval) عیناً همان است که بود. شنوندهٔ سراسریِ خطا
     خطاهای void-music.js و void-music-web.js را هم بدونِ دست‌زدنِ آن دو فایل ثبت می‌کند.
     خواندن: VoidMusicViz.web.diagnostics().errors     */
  const ERR = window.__vmErr = window.__vmErr || { ring: [], n: 0 };
  /* یک قابِ پشته در یک‌خط: «نامِ تابع@نامِ فایل:خط» (مسیرِ کامل حذف می‌شود؛ در ویندوز
     جداکننده Backslash است، پس split روی هر دو). */
  function frameOf(s) {
    const t = String(s).trim().replace(/^at\s+/, '');
    const i = t.lastIndexOf(' ('), j = t.lastIndexOf(')');
    const pick = function (p) { const seg = String(p).split(/[\\/]/); return seg[seg.length - 1]; };
    if (i > 0 && j > i) return t.slice(0, i) + '@' + pick(t.slice(i + 2, j));
    return pick(t);
  }
  function errPush(tag, e, isAsync) {
    try {
      ERR.n++;
      const name = (e && e.name) || 'Error';
      const msg = String((e && e.message) || e || '').slice(0, 160);
      const where = (e && e.stack ? String(e.stack).split('\n').slice(1, 4).map(frameOf) : []).join(' <- ');
      const last = ERR.ring[ERR.ring.length - 1];
      if (last && last.err === name + ': ' + msg && last.tag === tag && performance.now() - last.at < 1500) return;   // پخشِ دوباره از two listeners
      const rec = { at: Math.round(performance.now()), tag: tag, err: name + ': ' + msg, where: where };
      if (isAsync) rec.a = 1;                                       // از promise آمده، نه از throwِ همیشگی
      ERR.ring.push(rec);
      while (ERR.ring.length > 40) ERR.ring.shift();
    } catch (x) {}
  }
  /* §0.۱ خطای یک تابعِ async به شکلِ rejection بیرون می‌آید (در Chrome به onunhandledrejection
     می‌رود) و try/catchِ همیشگی آن را نمی‌بیند. attach همان rejection را با برچسبِ *جای
     فراخوانی* ثبت می‌کند و دوباره reject می‌کند تا مسیرِ صفحهٔ مرورگر دست‌نخورده بماند.
     (شنوندهٔ سراسریِ promise پایین‌تر همچنان همه را بی‌برچسبِ محلی هم می‌گیرد.) */
  function attach(tag, p) { if (p && typeof p.then === 'function') p.then(undefined, function (e) { errPush(tag, e, true); throw e; }); return p; }
  function guard(fn, tag) {
    return function (arg) { try { return fn(arg); } catch (e) { errPush(tag, e); throw e; } };
  }
  // زنجیرهٔ rAF تنها چیزی است که با خطا *می‌میرد* (interval خودش دوباره می‌خواند). این wrapper
  // مرگِ زنجیره را ثبت می‌کند ولی آن را وصل نمی‌کند — در این فاز فقط دیدن، نه درمان.
  function guardChain(fn, tag, rafOf, runningOf) {
    return function (arg) {
      try { return fn(arg); } catch (e) {
        errPush(runningOf() && !rafOf() ? tag + ' LOOP-LOST:rAF-not-re-armed' : tag, e);
        throw e;
      }
    };
  }
  window.addEventListener('error', function (e) {
    const node = e.target && e.target.tagName ? e.target.tagName + ':' + (e.target.src || e.target.href || '') : '';
    if (node) { errPush('resource:' + node, { name: 'ResourceError', message: String(e.target.src || e.target.href || '').slice(-90) }); return; }
    errPush('page:' + String((e.filename || '').split('/').pop()) + ':' + e.lineno, e.error || { name: 'Error', message: e.message });
  });
  window.addEventListener('unhandledrejection', function (e) {
    errPush('promise', (e.reason && e.reason.name) ? e.reason : { name: 'UnhandledRejection', message: String(e.reason) });
  });

  /* ---- صدای واقعیِ تبِ دیگر (chrome.tabCapture → getUserMedia در Void Tab) ---- */
  const EXT = { stream: null, src: null, watch: null };

  /* §1.1 «موسیقی پخش می‌شود؟» برای منبعِ تب از خودِ stream تصمیم گرفته می‌شود، نه از
     proxy.paused: در صفحه‌های چندِالمنتی المنتِ اشتباه انتخاب می‌شود و pausedِ کاذبش
     تحلیل را برای همیشه خاموش می‌کند (chip زنده، کهکشان بی‌حرکت). سکوتِ واقعی را همان
     RMS و A.silent می‌شناسد. منبعِ محلی: دقیقاً مثلِ قبل، بی‌هیچ تغییرِ رفتار.
     HOTFIX: قاعدهٔ سختِ §1.1 (only live and unmuted → playing) تبِ capture‌شدهٔ ساکت/
     mute‌شده را «نپخش» می‌کرد و کهکشان را خاموش می‌کرد. حالا 'or' است: چیزی که تب گزارش
     می‌کند (paused=false) **یا** trackی که 'live' است کافی است؛ muted فقط یک خبر است نه ترمز. */
  function streamInfo() {
    if (!EXT.stream) return { state: 'none', n: 0, ready: 'none', muted: false, live: false, liveAny: false };
    let trs; try { trs = EXT.stream.getAudioTracks() || []; } catch (e) { trs = []; }
    if (!trs.length) return { state: 'connected', n: 0, ready: 'no_track', muted: false, live: false, liveAny: false };
    let live = false, liveAny = false, allMuted = true, ready = '';
    for (let i = 0; i < trs.length; i++) {
      const t = trs[i];
      if (t.readyState === 'live') liveAny = true;               // HOTFIX: بی‌توجه به muted
      if (t.readyState === 'live' && !t.muted) live = true;      // قاعدهٔ سختِ Phase 1 (legacy)
      if (!t.muted) allMuted = false;
      ready += (ready ? '/' : '') + t.readyState;
    }
    return { state: 'connected', n: trs.length, ready: ready, muted: allMuted, live: live, liveAny: liveAny };
  }
  /* §AMBIENT «چند میلی‌ثانیه از آخرین گزارشِ وضعیتِ این تب می‌گذرد؟» proxy._at در
     void-music-web.js:applyState (و در play/pause محلیِ همان proxy) نو می‌شود — یعنی دقیقاً همان
     «آخرین vm-web-state / پاسخِ ping» که معیارِ تازگی است، بدونِ هیچ وابستگیِ تازه به آن فایل.
     _at=0 (هرگز گزارشی نرسیده) = بی‌انتها کهنه: لایهٔ محیطی فقط با گزارشِ واقعی روشن می‌شود. */
  function webReportAgeMs(a) {
    if (!a || !a.__web) return -1;
    const at = +a._at || 0;
    return at ? Math.max(0, performance.now() - at) : Infinity;
  }
  function siteReportedPlayingFresh(a) {
    if (!a || !a.__web || a.paused) return false;
    const age = webReportAgeMs(a);
    return age >= 0 && age <= CFG.webFreshMs;
  }
  /* یک خوانشِ مشترک برای همهٔ مصرف‌کننده‌ها (tapsWanted، mini، bgKick، حلقه، رویدادها).
     'or' = reported-playing **یا** trackِ live؛ با یک قید: «سکوت» فقط وقتی ترمز است که
     واقعاً اندازه گرفته شده باشد (A.measured) و تحلیلگرها وصل باشند — تا reportِ کاذبِ
     paused و trackِ mute‌شده کهکشان را نکشد، ولی مکثِ حقیقیِ تب (سکوتِ اندازه‌گرفته‌شده)
     مثلِ همیشه به آرامش برسد. این همان «سکوت را RMS می‌شناسد» است، نه پرچمِ track. */
  function silenceMeasured() { return !!(A.ok && A.tapped && A.measured > 2 && A.silent); }
  function webPlaying(a, si) {
    si = si || streamInfo();
    if (CFG.webPlayRule === 'legacy') return !a.paused;          // بازگشتِ کامل به پیش از Phase 1
    /* §AMBIENT گزارشِ تازهٔ «پخش» خودش کافی است، حتی با هیچ streamی: صدای تب هنوز capture نشده
       (یا capture رد شده) ولی آهنگ در تبش نواخته می‌شود ⇒ کهکشان با لایهٔ ambient زنده است.
       با webFallback='off' این شاخه وجود ندارد و همان تاریکیِ قبلی برمی‌گردد. */
    if (CFG.webFallback === 'ambient' && siteReportedPlayingFresh(a)) return true;
    // stream یا trackی که همه‌اش ended است صدایی به تحلیلگر نمی‌رساند: «پخش» باورپذیر نیست.
    // دقت: only readyState. `muted` در tabCaptureِ بی‌صدا true است و هرگز ترمز نیست.
    if (!si.liveAny) return false;
    if (!a.paused) return true;                                  // تب می‌گوید پخش
    return !silenceMeasured();                                   // track زنده ولی تب «مکث»: فقط سکوتِ اندازه‌گرفته‌شده ترمز است
  }
  /* درِ تحلیلگرها: تا streamِ زنده‌ای هست، اندازه بگیر (وگرنه سکوت هرگز اندازه گرفته نمی‌شود
     و قاعدهٔ بالا در «مکثِ کاذب» قفل می‌کند). منبعِ محلی: همان paused، دست‌نخورده. */
  function tapsSignal(a) {
    if (!a) return false;
    if (!a.__web) return !a.paused;
    return CFG.webPlayRule === 'legacy' ? !a.paused : streamInfo().liveAny;
  }
  function playSignal(a) { return a ? (a.__web ? webPlaying(a) : !a.paused) : false; }
  /* §HOTFIX(۲) منبعِ تب را وقتی track زنده است معلق نکن. قاعدهٔ 'or' سکوتِ *اندازه‌گرفته‌شده*
     را ترمز می‌داند، ولی suspend() یعنی analyzer بی‌داده → سکوتِ بیات تا ابد → هرگز بیدار
     نمی‌شود (پذیرش «resume → lit again» با suspend هرگز برقرار نمی‌شد). صدای دوباره ندارد:
     routeOutput برای منبعِ وب خروجی را به sink با gain=0 می‌برد، پس contextِ روشن فقط تحلیل
     می‌کند. منبعِ محلی: رفتارِ دست‌نخورده (suspend می‌شود). */
  function suspendAllowed(a) {
    if (CFG.webPlayRule === 'or' && a && a.__web && streamInfo().liveAny) return false;
    return true;
  }
  /* فقط برای diagnostics: کدام شرط «پخش» را true/false کرد. هیچ تصمیمی اینجا گرفته نمی‌شود. */
  function playWhy(a) {
    if (!a) return 'IDLE:no_element';
    if (!a.__web) return (a.paused ? 'IDLE' : 'PLAY') + ':local_paused_flag';
    const si = streamInfo();
    const yes = webPlaying(a, si);
    const why = CFG.webPlayRule === 'legacy' ? (a.paused ? 'legacy_paused' : 'legacy_playing')
      : (!si.liveAny ? (si.state === 'none' ? 'no_stream' : 'no_live_track')
        : (!a.paused ? 'reported_playing' : (silenceMeasured() ? 'measured_silence' : 'track_live_unmeasured_or_audible')));
    return (yes ? 'PLAY:' : 'IDLE:') + why +
      ' {rule=' + CFG.webPlayRule + ' paused=' + !!a.paused + ' ready=' + si.ready +
      ' muted=' + si.muted + ' liveAny=' + si.liveAny + ' strict=' + si.live +
      ' silent=' + !!A.silent + ' measured=' + A.measured + ' tapped=' + !!(A.ok && A.tapped) +
      ' freshMs=' + (a.__web ? (isFinite(webReportAgeMs(a)) ? Math.round(webReportAgeMs(a)) : 'never') : 'n/a') + '}';
  }
  /* §AMBIENT سه لایهٔ پخش. LIVE = دادهٔ صوتیِ واقعی به تحلیلگر می‌رسد. AMBIENT = پخش باورپذیر است
     ولی داده‌ای نیست (صدای تب capture نشده / گراف نساخته) ⇒ نمایشِ تزئینی با انرژیِ ساختگی.
     IDLE = هیچ‌کدام. لایه فقط «داده هست یا نه» را می‌گوید؛ تصمیمِ پخش همان playSignal است و
     هیچ‌جا تاریکیِ جدید نمی‌سازد: playing=false ⟸ tier=idle، وگرنه tier هرگز playing را نمی‌بندد. */
  function tierEval(a) {
    a = a || VM.getAudio();
    if (!a) return { tier: 'idle', why: 'IDLE:no_element' };
    if (!a.__web) return { tier: V.playing ? 'live' : 'idle', why: (V.playing ? 'PLAY' : 'IDLE') + ':local_element' };
    if (CFG.webFallback !== 'ambient') {                       // 'off' = هیچ لایه‌ای اضافه نمی‌شود
      if (!V.playing) return { tier: 'idle', why: 'fallback_off:not_playing' };
      // بدونِ قضاوتِ تازه: «گراف دارد = تحلیل زنده، گراف ندارد = همان مسیرِ تزئینیِ همیشگی».
      // خواندنِ FEAT.quality اینجا حلقهٔ بازِ tier→quality→tier می‌ساخت (یک‌بار ambient، همیشه ambient).
      return { tier: A.ok ? 'live' : 'ambient', why: 'fallback_off:' + (A.ok ? 'analysis' : 'no_graph') };
    }
    if (!V.playing) return { tier: 'idle', why: playWhy(a) };
    const si = streamInfo();
    // stream زنده + گرافِ ساخته = مسیرِ دادهٔ واقعی؛ بسته *بودنِ* درِ تحلیلگر news است نه
    // نبودِ داده (نظرسنجیِ ۳ ثانیه‌ای بازش می‌کند)، پس لایه را عوض نمی‌کند.
    if (A.ok && si.liveAny)
      return { tier: 'live', why: !A.tapped ? 'LIVE:stream_taps_closed' : (silenceMeasured() ? 'LIVE:grace_after_measured_silence' : 'LIVE:analysis') };
    const age = webReportAgeMs(a);
    if (age >= 0 && age <= CFG.webFreshMs) return { tier: 'ambient', why: 'AMBIENT:fresh_report_' + Math.round(age) + 'ms' };
    if (si.liveAny) return { tier: 'ambient', why: 'AMBIENT:track_live_no_analysis' };
    return { tier: 'idle', why: 'IDLE:no_data_and_no_fresh_report' };
  }
  /* §IDLE آیا منبعِ فعلی «صدا هست ولی موسیقی نیست» است؟ فقط از لایهٔ منبع پرسیده می‌شود
     (activeInfo.audioOnly) — خودِ اینجا هرگز «صدا» را با «موسیقی» یکی نمی‌گیرد و هیچ حدسی
     نمی‌زند: نه عنوان، نه duration، نه RMS. منبعِ محلی (فایل) هرگز وارد این شاخه نمی‌شود.
     بی‌هزینه نگه داشتنش مهم است: این تابع getState() را می‌خواند، پس حداکثر ۲ بار در ثانیه. */
  function idleAudioEval() {
    if (!CFG.idleHalo) return 'flag_off';
    const a = VM.getAudio();
    if (!a) return 'no_element';
    if (!a.__web) return 'local_source';                       // فایلِ محلی: رفتارِ دست‌نخورده
    if (!VM.isOpen()) return 'mode_closed';
    if (document.hidden) return 'hidden';
    if (reduced()) return 'reduced_motion';
    let st = null;
    try { st = VM.webState && VM.webState(); } catch (e) { return 'web_state_error'; }
    const ai = st && st.activeInfo;
    if (!ai) return 'no_active_source';
    if (ai.tabId !== a.tabId) return 'not_this_source';         // فقط دربارهٔ همان منبعی که به آن وصلیم
    if (ai.contact !== 'live') return 'bridge_not_live';        // پلِ تب دیگر پاسخ نمی‌دهد: منبع نمانده است
    return ai.audioOnly ? 'audio_only_source' : 'music_source';
  }
  /* نورِ هاله در این حالت: فقط زمانِ قطعی (V.haloT) — هیچ عددی از FEAT/A نمی‌آید، پس صحنه
     با صدایِ حرف‌زدنِ کسی نمی‌پرد و ادعایِ «تحلیلِ موسیقی» نمی‌شود. دامنهٔlow و آهسته است تا
     «ظریف» بماند و برای نورحساسی خطرناک نباشد. */
  function idleHaloEnergy() { return 0.16 + 0.10 * Math.sin(V.haloT * 0.23); }
  function idleHaloLevel() { return clamp(CFG.idleHaloLevel, 0, 1) * (0.86 + 0.14 * Math.sin(V.haloT * 0.31)); }
  /* §SCENE رأیِ «چه منبعی هست» — فقط از همان خوانش‌هایی که idleAudioEval هم می‌خواند، و حداکثر
     دو بار در ثانیه (از همان تیکِ idlePoll) یا هنگامِ رویدادهایِ منبع. سه نتیجهٔ ممکن:
       'local'     المنتِ فایلِ خودِ پخش‌کن، به‌شرطی که واقعاً آهنگی بارگذاری شده باشد —
                   ensureAudio() یک المنتِ بی‌src هم می‌سازد، پس «بودنِ المنت» منبع نیست.
       'web'       منبعِ تب با پلِ زنده و همین tabId.
       'audioOnly' صدا هست ولی موسیقی نیست (رأیِ خودِ لایهٔ منبع) ⇒ کهکشان بیدار نمی‌شود.
       'none'      منبعی نیست ⇒ idle.
     هیچ‌جا «تشخیص» جای «پخش» را نمی‌گیرد: این تابع هرگز playing نمی‌دهد. */
  function scenePoll() {
    if (!CFG.scene) { V.srcKind = 'none'; V.sceneWhy = 'scene:off'; return; }
    const a = VM.getAudio();
    if (!a) { V.srcKind = 'none'; V.sceneWhy = 'scene:no_element'; return; }
    if (!a.__web) {
      let st = null;
      try { st = VM.getState && VM.getState(); } catch (e) { st = null; }
      const loaded = (st && st.current !== null && st.current !== undefined) || !!a.currentSrc;
      V.srcKind = loaded ? 'local' : 'none';
      V.sceneWhy = loaded ? 'scene:local_track' : 'scene:local_empty';
      return;
    }
    let w = null;
    try { w = VM.webState && VM.webState(); } catch (e) { V.srcKind = 'none'; V.sceneWhy = 'scene:web_state_error'; return; }
    const ai = w && w.activeInfo;
    if (!ai) { V.srcKind = 'none'; V.sceneWhy = 'scene:no_active_source'; return; }
    if (ai.tabId !== a.tabId) { V.srcKind = 'none'; V.sceneWhy = 'scene:not_this_source'; return; }
    if (ai.contact !== 'live') { V.srcKind = 'none'; V.sceneWhy = 'scene:bridge_not_live'; return; }
    if (ai.audioOnly) { V.srcKind = 'audioOnly'; V.sceneWhy = 'scene:audio_only_source'; return; }
    V.srcKind = 'web'; V.sceneWhy = 'scene:music_source';
  }
  /* §SCENE مشتقِ بی‌خوانش (هر فریم، صفر alloc): تنها ورودی‌هایش V.playing و کشِ scenePoll‌اند،
     پس هیچ منبعِ حقیقتِ دومی نمی‌سازد و با tier/idleAudio در نمی‌افتد. */
  function visualState() {
    if (V.playing) return 'playing';
    return (V.srcKind === 'web' || V.srcKind === 'local') ? 'source' : 'idle';
  }
  /* §SCENE جایی که کهکشان در «منبع هست، پخش نیست» می‌نشیند. از holeRest پایین‌تر نمی‌آید
     (بیداری هرگز تاریکیِ بیشتر نسازد) و از ۱ بالا نمی‌رود. */
  function awakenTarget() { return clamp(CFG.awakenLevel, CFG.holeRest, 1); }
  /* §DORMANT idle = «کهکشانِ خفته» (به‌جای هالهٔ تنها). از holeRest پایین‌تر هم می‌تواند بیاید: هدف «نورِ بسیار کم» است. */
  function dormantOn() { return !!(CFG.scene && CFG.idleGalaxy); }
  function dormantTarget() { return clamp(CFG.idleGalaxyLevel, 0, 1); }
  function sceneWanted() { return !!CFG.scene && VM.isOpen() && (V.vstate === 'idle' || V.vstate === 'source'); }
  /* §SCENE تک‌فریمِ بی‌حرکت برایِ prefers-reduced-motion: صحنه «مرده» نمی‌ماند ولی هیچ
     انیمیشنی هم نمی‌بیند. مخلوط‌ها بی‌درنگ رویِ هدفِ خودشان می‌نشینند، یک فریم رسم می‌شود و
     حلقه اجرا نمی‌شود (نه rAF، نه تایمر). بیرون از Motion-Reduce هرگز صدا نمی‌کند. */
  function paintSceneStill() {
    if (!CFG.scene || V.playing || V.running || !VM.isOpen() || document.hidden || !reduced()) return false;
    if (!V.ok && !initGL()) return false;
    V.vstate = visualState();
    const idle = V.vstate === 'idle';
    V.idleX = idle ? 1 : 0; V.awakenX = idle ? 0 : 1;
    V.L.aurora = 0; V.L.galaxy = idle ? (dormantOn() ? dormantTarget() : 0) : awakenTarget(); V.L.lum = 0.35;   // §DORMANT
    // همان فازِ ایستِ حلقه (بی‌حرکت): عددِ حرکتِ هاله از V.haloT خوانده می‌شود و haloT جلو نمی‌رود،
    // پس Motion-Reduce یک فریمِ «زنده ولی بی‌جنبش» می‌بیند، نه انیمیشنِ تیک‌تیک‌ی ۳ ثانیه‌ای.
    V.idleE = V.haloE = idle ? idleHaloEnergy() : 0;
    V.sceneStill++;
    try { draw(performance.now() / 1000); } catch (e) { return false; }
    return true;
  }
  /* §IDLE بیدار-کنندهٔ حالت: حلقهٔ رندر در idleِ معمولی خودش می‌ایستد (و باید بایستد). تنها جایی
     که می‌تواند دوباره بیدارش کند، همان تیکِ ۳ ثانیه‌ایِ از-پیش-موجود است — تایمرِ تازه نمی‌سازیم. */
  function idleHaloCheck() {
    V.idleWhy = idleAudioEval();
    const on = V.idleWhy === 'audio_only_source';
    V.idleAudio = on;
    scenePoll(); V.vstate = visualState();                    // §SCENE همان تیک، رأیِ تازه
    // با scene خاموش، عیناً شرطِ قبلی: فقط «صدا بدونِ موسیقی» حلقه را بیدار می‌کرد.
    const keep = on || sceneWanted();
    if (!keep || V.running || !VM.isOpen() || document.hidden) return;
    if (reduced()) { paintSceneStill(); return; }             // §SCENE بی‌حرکت، ولی نه تاریک
    if (!V.ok && !initGL()) return;
    startLoop();                                               // هاله از idleX=0 بالا می‌آید؛ پرشِ نور نداریم
  }
  /* tierX نسبتِ مخلوطِ تزئینی است (۰ = دادهٔ واقعی، ۱ = محیطیِ خالص) و نرم جابه‌جا می‌شود تا
     آمدنِ capture وسطِ پخش — یا رفتنش — پرشِ نور نسازد (crossfade ~CFG.tierXFadeS ثانیه). */
  function tierUpdate(dt) {
    const t = tierEval();
    V.tier = t.tier; V.tierWhy = t.why;
    // 'off' = ماشینِ لایه کلاً از مدار خارج می‌شود (نه فقط تصمیم): مخلوط هرگز درگیر نمی‌گردد
    if (CFG.webFallback !== 'ambient') { V.tierX = 0; }
    else {
      const want = V.tier === 'ambient' ? 1 : 0;
      V.tierX += (want - V.tierX) * expK(dt, want > V.tierX ? CFG.tierXFadeS : CFG.tierXFadeS * 0.6);
      if (Math.abs(V.tierX - want) < 0.002) V.tierX = want;
    }
    /* §IDLE crossfadeِ هاله با همان شکلِ کارِ tierX (بی‌تایمر، بی‌رشتهٔ تازه). رأیِ حالت را
       حداکثر ۲ بار در ثانیه تازه می‌کنیم؛ آمدنِ منبعِ موسیقی = هاله بیرون، کهکشان درون — نرم
       و در جهتِ مخالفِ همان blend، پس هیچ فریمی دوباره-انیمیشن یا سیاهی نمی‌بیند. */
    V.idlePoll -= dt;
    if (V.idlePoll <= 0) { V.idlePoll = 0.5; V.idleWhy = idleAudioEval(); V.idleAudio = V.idleWhy === 'audio_only_source'; scenePoll(); }
    /* §SCENE رأیِ حالت هر فریم فقط از کش خوانده می‌شود (صفر DOM، صفر alloc). با scene خاموش،
       iWant عیناً همان عبارتِ قبلی است: تنها «صدا بدونِ موسیقی» هاله را بالا می‌برد. */
    V.vstate = visualState();
    const iWant = CFG.scene ? (V.vstate === 'idle' ? 1 : 0) : (V.idleAudio ? 1 : 0);
    V.idleX += (iWant - V.idleX) * expK(dt, CFG.idleHaloFadeS);
    if (Math.abs(V.idleX - iWant) < 0.002) V.idleX = iWant;
    /* §SCENE بیداریِ «منبع هست، پخش نیست»: با همان expK و بی‌رویداد، پس تکرارِ تشخیصِ منبع
       هرگز این گذار را از نو نمی‌شکند (no restart, no pop) و خروج به idle نرم برگردانده می‌شود.
       ورود آهسته‌تر از خروج است تا کهکشان با «آمدنِ» یک تبِ تازه جرقه نزند. */
    const aWant = (CFG.scene && V.vstate === 'source') ? 1 : 0;
    V.awakenX += (aWant - V.awakenX) * expK(dt, aWant > V.awakenX ? CFG.awakenFadeS : CFG.awakenFadeS * 0.7);
    if (Math.abs(V.awakenX - aWant) < 0.002) V.awakenX = aWant;
  }
  /* انرژیِ تزئینیِ محیطی: همان منحنیِ v42، حالا یک صاحبِ واحد دارد (پیش‌تر در دو جا کپی بود:
     updateStage و step — دو نسخهٔ جدا یعنی امکانِ واگراییِ نمایش). */
  function ambientEnergy(nowS) { return clamp(0.52 + 0.30 * Math.sin(nowS * 0.33) + 0.12 * Math.sin(nowS * 1.1), 0, 1); }
  /* انرژی‌ای که نمایش می‌خواند: واقعی، تزئینی، یا مخلوطِ نرمِ دوتا. با webFallback='off' و
     tierX=0 دقیقاً همان عبارتِ قبلی است (FEAT.quality==='ambient' ? ساختگی : FEAT.energy). */
  function displayEnergy(nowS) {
    const eA = showOwnsDisplay() ? showEnergy(ambientEnergy(nowS)) : ambientEnergy(nowS);
    if (CFG.webFallback !== 'ambient' || V.tierX <= 0.001) return FEAT.quality === 'ambient' ? eA : FEAT.energy;
    const real = (FEAT.quality === 'ambient' || V.tier === 'ambient') ? eA : FEAT.energy;
    return clamp(eA * V.tierX + real * (1 - V.tierX), 0, 1);
  }

  /* ==================================================================
     §SHOW — «کارگردانِ» لایهٔ ambient
     یک نمایشِ زمان‌محور و قطعی برای وقتی که *هیچ دادهٔ صوتیِ واقعی* به تحلیلگر نمی‌رسد
     (صدای تب capture نشده یا stream مُرده است، ولی تب تازه می‌گوید پخش می‌کند).
     صداقیت: این کد هیچ‌جا mوزیک را «می‌شنود». ورودی‌هایش فقط سه چیز است:
       ۱) زمانِ سپری‌شده درونِ نمایش (s.t)، ۲) seed = hash(عنوان + میزبان + طولِ گزارش‌شده)،
       ۳) خودِ لایه (ambient) و پلهٔ کیفیت. هیچ عددی از آن به FEAT برنمی‌گردد، پس
       quality هرگز 'live' نمی‌شود و چیپ دروغ نمی‌گوید. ambientShow=false ⇒ این بلوک
       اجرا نمی‌شود و همان ambientِ پیشین (بدونِ هیچ تغییرِ دیگری) بازمی‌گردد.
     افکت‌ها همه از همین فایل‌اند: spawnComet / spawnBloom / awakenDistantGroups /
     startStarFlight / V.flare (همان uFlare) / V.cosmic.glow / V.ejBurst / ماشینِ dive.
     دو hookِ جدید و حداقلی (چون جایِ درستِ دیگری نبود):
       الف) شکل‌دادنِ منحنیِ *تزئینی* در displayEnergy (فقط در شعبهٔ ambient؛ LIVE/local نه)،
       ب) یک کرومایِ آرایشیِ جدا (V.show.chroma) که فقط در draw به‌جای A.chroma آپلود می‌شود
          و A.chroma (حافظهٔ تحلیل) را اصلاً لمس نمی‌کند؛ وزنِ آن V.tierX است، پس در
          crossfade با LIVE نرم جابه‌جا می‌شود و در LIVE دقیقاً همان آرایهٔ قبلی می‌ماند.
     photosensitivity: تغییرِ روشنایی با SHOW.maxEnvPerS محدود به نرخ می‌شود (نه پله)،
     دو پرشِ تیز حداقل SHOW.minEventGapS ثانیه فاصله، و flare با SHOW.flashGapS ≤ ۲Hz.
     پنهان‌بودنِ تب: حلقهٔ رندر (rAF) نمی‌چرخد و s.t هم جلو نمی‌رود — یعنی بی‌رندر و بی‌پرش.
     ================================================================== */
  function showDensity() { return SHOW.density[clamp(Q.tier | 0, 0, 2)] || 1; }
  function showWanted() {
    // §IDLE: «کارگردانِ» ambient یک روایتِ *موسیقی* است؛ در حالتِ «صدا بدونِ موسیقی» کهکشان
    // سرکوب شده است، پس نمایش هم اجرا نمی‌شود (نه افکت، نه خرجِ محاسباتی‌اش).
    return !!(CFG.ambientShow && CFG.webFallback === 'ambient' && V.tier === 'ambient' &&
      V.playing && VM.isOpen() && !document.hidden && !reduced() && !V.idleAudio);
  }
  function showOwnsDisplay() { return !!(V.show.on && CFG.ambientShow && CFG.webFallback === 'ambient'); }
  function showSeedSrc() {
    const a = VM.getAudio();
    let host = '';
    try { const st = VM.webState && VM.webState(); host = (st && st.activeInfo && st.activeInfo.host) || ''; } catch (e) {}
    const dur = a && Number.isFinite(a.duration) && a.duration > 0 ? Math.round(a.duration) : 0;
    return V.show.title + '\u0001' + host + '\u0001' + dur;
  }
  /* بازشمارِ یک بازهٔ ثانیه‌ای با کمی تنوعِ قطعی؛ پله‌هایِ پایینِ کیفیت افکت‌ها را رقیق می‌کند. */
  function showSpan(minS, randS) { return (minS + V.show.rng() * randS) / Math.max(0.4, showDensity()); }
  function showBegin() {
    const s = V.show;
    s.seedSrc = showSeedSrc(); s.seed = hash32(s.seedSrc);
    s.rng = mulberry32((s.seed ^ 0x5F5A7A13) >>> 0);
    s.begins++; s.on = true; s.t = 0; s.phase = 'overture';
    s.level = clamp(+CFG.ambientShowLevel || 0, 0, 1);
    s.env = 0; s.envTarget = 0; s.hueIdx = s.seed % 7;
    s.lastFlareAt = -99; s.maxEnvRate = 0;
    for (let i = 0; i < 12; i++) { s.chroma[i] = 0; s.pattern[i] = 0; s.wake[i] = 0; s.order[i] = i; s.wOff[i] = s.rng(); }
    // ترتیبِ بیداریِ حلقه‌ها: همان آهنگ ⇒ همان ترتیب (قطعی از seed)، آهنگِ دیگر ⇒ ترتیبِ دیگر
    for (let i = 11; i > 0; i--) { const j = Math.floor(s.rng() * (i + 1)); const x = s.order[i]; s.order[i] = s.order[j]; s.order[j] = x; }
    s.nextCometAt = showSpan(SHOW.cometMinS, SHOW.cometRandS);
    s.nextBloomAt = 2 + showSpan(SHOW.bloomMinS, SHOW.bloomRandS);
    s.nextWakeAt = 4 + showSpan(SHOW.wakeMinS, SHOW.wakeRandS);
    s.nextFlightAt = showSpan(SHOW.flightMinS, SHOW.flightRandS);
    s.nextSurgeAt = showSpan(SHOW.surgeMinS, SHOW.surgeRandS);
    s.surgeEndAt = 0; s.breathEndAt = 0;
  }
  /* شکلِ منحنیِ تزئینی: همان منحنیِ v42 کمی کوتاه‌شده + بلندِ آهستهٔ قوسِ روایت.
     سقفِ output همان ۱ است و نرخِ تغییر را limiterِ پایین‌تر تضمین می‌کند. */
  function showEnergy(eA) {
    const s = V.show, L = s.level;
    if (L <= 0) return eA;
    return clamp(eA * (1 - SHOW.energyTrim * L) + SHOW.energyGain * L * s.env, 0, 1);
  }
  function showUpdate(dt, nowS) {
    const s = V.show, want = showWanted();
    if (!want) { s.on = false; return; }
    // آهنگ/سایت عوض شده؟ ⇒ پالت و روایتِ تازه (با همان seedِ قطعی) و پیش‌درآمدِ دوباره
    if (!s.on || !s.rng) showBegin();
    else if (s.seedSrc !== showSeedSrc()) showBegin();
    else s.on = true;
    s.level = clamp(+CFG.ambientShowLevel || 0, 0, 1);
    const L = s.level;
    s.t += Math.min(dt, 0.1);
    const t = s.t, ct = V.cosmic.activeElapsed;      // ساعتِ افکت‌ها همان ساعتِ cosmic است (دنباله‌دار/بloom آن را می‌خوانند)

    // ——— قوسِ روایت: پیش‌درآمد ← کروز ← اوج ← نفس ———
    if (s.phase === 'overture' && t >= SHOW.overtureS) { s.phase = 'cruise'; s.nextSurgeAt = t + showSpan(SHOW.surgeMinS, SHOW.surgeRandS); }
    else if (s.phase === 'surge' && t >= s.surgeEndAt) { s.phase = 'breath'; s.breathEndAt = t + showSpan(SHOW.breathMinS, SHOW.breathRandS); }
    else if (s.phase === 'breath' && t >= s.breathEndAt) { s.phase = 'cruise'; s.nextSurgeAt = t + showSpan(SHOW.surgeMinS, SHOW.surgeRandS); }

    if (s.phase === 'overture') s.envTarget = 0.16 + 0.34 * smoother5(t / SHOW.overtureS);
    else if (s.phase === 'surge') s.envTarget = 0.92;
    else if (s.phase === 'breath') s.envTarget = SHOW.envLo + 0.06 * Math.sin(t * 0.09);
    else s.envTarget = clamp(0.46 + 0.20 * Math.sin(t * 0.11 + s.wOff[0] * TAU) + 0.12 * Math.sin(t * 0.037 + s.wOff[1] * TAU), 0, 1);
    // limiterِ سخت: روشنایی هیچ‌وقت سریع‌تر از SHOW.maxEnvPerS در ثانیه عوض نمی‌شود (حساسیتِ نوری)
    const prev = s.env, maxStep = SHOW.maxEnvPerS * Math.max(dt, 0.0001);
    s.env = clamp(s.env + clamp(s.envTarget - s.env, -maxStep, maxStep), 0, 1);
    const rate = Math.abs(s.env - prev) / Math.max(dt, 0.0001);
    if (rate > s.maxEnvRate) s.maxEnvRate = rate;

    // بیداریِ حلقه‌ها: در پیش‌درآمد یکی‌یکی با ترتیبِ seed؛ بعد از آن نفسِ آهستهٔ زمان (نه ضربهٔ موسیقی)
    for (let i = 0; i < 12; i++) {
      const rb = s.order[i];
      s.wake[rb] = s.phase === 'overture'
        ? smoother5((t - i * SHOW.ringStepS) / SHOW.ringRiseS)
        : clamp(0.55 + 0.45 * Math.sin(t * 0.14 + s.wOff[rb] * TAU), 0, 1);
    }
    const amp = clamp(0.62 * L * (0.35 + 0.65 * s.env), 0, 1);
    for (let i = 0; i < 12; i++) s.pattern[i] = clamp(amp * s.wake[i] * (0.55 + 0.45 * Math.sin(t * (0.20 + 0.16 * (i % 3)) + s.wOff[i] * TAU)), 0, 1);
    s.hueIdx = ((s.seed % 7) + Math.floor(t / SHOW.huePeriodS)) % 7;

    // ——— افکت‌های کروز: فقط تابع‌های موجود، با فاصله‌های تازه‌ریزی‌شده (بی‌تکرارِ آشکار) ———
    if (s.phase !== 'breath') {
      if (t >= s.nextBloomAt) { spawnBloom(ct, clamp(0.5 + 0.45 * s.env * L, 0, 1)); s.nBloom++; s.nextBloomAt = t + showSpan(SHOW.bloomMinS, SHOW.bloomRandS); }
      if (t >= s.nextCometAt) { if (spawnComet(ct, 0.22 * s.env * L)) s.nComet++; s.nextCometAt = t + showSpan(SHOW.cometMinS, SHOW.cometRandS); }
      if (t >= s.nextWakeAt) { awakenDistantGroups(ct, Q.tier >= 2 ? 2 : 1, clamp(0.34 + 0.30 * s.env * L, 0, 1)); s.nWake++; s.nextWakeAt = t + showSpan(SHOW.wakeMinS, SHOW.wakeRandS); }
      if (t >= s.nextFlightAt) {
        // فورانِ ستارگان تنها اگر ستارهٔ امتیازیِ واقعی روی صفحه باشد معنا دارد؛ وگرنه بی‌کار است
        let has = false; try { const r = VM.getStarRects && VM.getStarRects(); has = !!(r && r.length); } catch (e) {}
        if (has) { startStarFlight(); s.nFlight++; } else s.nFlightNoStars++;
        s.nextFlightAt = t + showSpan(SHOW.flightMinS, SHOW.flightRandS);
      }
    }

    // ——— اوج: همان ماشینِ dive، بدونِ هیچ «اوجِ موسیقی» ساختگی ———
    if (s.phase !== 'breath' && t >= s.nextSurgeAt && t - s.lastJumpAt >= SHOW.minEventGapS) {
      const op = V.opening;
      if (op.started && op.phase === 'travel' && op.evAt < 0) {
        op.evAt = op.elapsed;
        op.evLen = clamp(op.eventS || DIVE.minEventS, DIVE.minEventS, DIVE.maxEventS);
        s.phase = 'surge'; s.surgeEndAt = t + Math.min(SHOW.surgeHoldS, op.evLen * 0.9);
        s.lastJumpAt = t; s.nSurge++;
        V.ejBurst = Math.min(0.5, V.ejBurst + 0.30 * L);                 // فورانِ جت‌های لبه (موجِ نرم، خودش محو می‌شود)
        V.cosmic.glow = Math.max(V.cosmic.glow, 0.30 * L);                // هالهٔ گروه‌های دوردست
        spawnBloom(ct, clamp(0.75 + 0.25 * L, 0, 1)); s.nBloom++;
        awakenDistantGroups(ct, Q.tier >= 2 ? 3 : 2, clamp(0.45 + 0.25 * L, 0, 1)); s.nWake++;
      } else { s.nSurgeNoGate++; s.nextSurgeAt = t + 6; }                 // درِ تونل در دسترس نیست: کوتاه صبر کن
    }
    if (s.phase === 'surge') {
      // flareِ افق: با نرخِ محدود بالا می‌آید (پله‌ای نیست) و با decayِ خودش می‌نشیند؛ ≤۲Hz
      const cap = SHOW.flareMax * L;
      if (V.flare < cap && t - s.lastFlareAt >= SHOW.flashGapS) { V.flare = Math.min(cap, V.flare + SHOW.flareRate * dt); s.lastFlareAt = t; }
    }
  }
  /* کرومایِ آرایشیِ لایهٔ ambient (فقط برای آپلودِ uChroma). آرایهٔ تحلیل (A.chroma) دست‌نخورده
     می‌ماند؛ در crossfade با وزنِ V.tierX مخلوط می‌شود و در LIVE همان A.chroma برمی‌گردد. */
  function displayChroma() {
    const s = V.show;
    if (!showOwnsDisplay()) return A.chroma;
    const w = clamp(SHOW.chromaW * s.level * V.tierX, 0, 1);
    if (w <= 0.001) return A.chroma;
    for (let i = 0; i < 12; i++) s.chroma[i] = A.chroma[i] * (1 - w) + s.pattern[i] * w;
    return s.chroma;
  }

  /* ==================================================================
     §ENCHANT — «اژدهای خفته» (idle) و «بیدارشدنِ باشکوه» (آغازِ پخش)
     فقط بصری: نه تحلیلِ صدا، نه capture، نه تصمیمِ پخش. ورودی‌ها فقط V.playing (که بقیهٔ فایل
     تعیین می‌کند)، idleX (همان blendِ هاله) و ساعتِ خودِ این بلوک‌اند.
     ورود فقط وقتی شروع می‌شود که *گذارِ* «پخش نمی‌شد ← پخش می‌شود» را در فریم‌های پیاپیِ
     Music Mode دیده باشیم (باز کردنِ صفحه وسطِ پخش، یا ازسرگیریِ کمتر از entranceCooldownS
     ثانیه بعد از مکث، نمایش را تکرار نمی‌کند).
     ================================================================== */
  const ENCH = { t: 0, flow: 0, lastT: 0, open: false, prevPlaying: false, lastPlayT: -999,
    intro: { on: false, t: 0, fired: false }, starts: 0, why: 'none' };
  const ENCH_TMP = { swell: 0, squeeze: 0, r1: 1, a1: 0, r2: 1, a2: 0 };
  const ENCH_OUT = { aura: 0, swell: 0, squeeze: 0, r1: 1, a1: 0, r2: 1, a2: 0 };
  /* منحنیِ بیدارشدن (ثانیه از شروع): ۰–۰٫۸ نفسِ کوتاه (هاله جمع می‌شود) · ۰٫۸ موجِ اول · ۱٫۲ موجِ دوم (ملایم) ·
     تورمِ نرمِ هاله و محوِ کاملش تا ~۴٫۸؛ بعد افکتِ اصلی تنها می‌ماند. همه smoother5 و پیوسته‌اند؛ هیچ پله/چشمک‌ی نیست (حساسیتِ نوری). */
  function enchEnvelope(tt, o) {
    o.swell = 0.45 * smoother5(tt / 1.5) * (1 - smoother5((tt - 2.2) / 2.6));
    o.squeeze = tt < 0.8 ? Math.sin(Math.PI * clamp(tt / 0.8, 0, 1)) * 0.6 : 0;
    const p1 = clamp((tt - 0.8) / 2.2, 0, 1), p2 = clamp((tt - 1.2) / 2.6, 0, 1);
    o.r1 = 1 + 3.4 * smoother5(p1); o.a1 = tt >= 0.8 ? 0.40 * smoother5(p1 / 0.15) * Math.pow(1 - p1, 1.3) : 0;
    o.r2 = 1 + 3.4 * smoother5(p2); o.a2 = tt >= 1.2 ? 0.22 * smoother5(p2 / 0.15) * Math.pow(1 - p2, 1.3) : 0;
    return o;
  }
  function enchStartIntro() { const I = ENCH.intro; I.on = true; I.t = 0; I.fired = false; ENCH.starts++; }
  /* هر فراخوانیِ draw یک بار: ساعتِ هاله، تشخیصِ گذارِ شروعِ پخش، و پیشبردِ ورود. */
  function enchStep(nowS, rm) {
    const dt = ENCH.lastT > 0 ? clamp(nowS - ENCH.lastT, 0, 0.1) : 0;
    const open = !!VM.isOpen(), playing = !!V.playing;
    const contiguous = ENCH.lastT > 0 && (nowS - ENCH.lastT) < 1.5 && ENCH.open && open;
    if (playing && !ENCH.prevPlaying) {
      if (!CFG.enchant || !CFG.grandEntrance) ENCH.why = 'flag_off';
      else if (!contiguous) ENCH.why = 'no_prior_frames';
      else if (rm) ENCH.why = 'reduced_motion';
      else if (document.hidden) ENCH.why = 'hidden';
      else if (ENCH.intro.on) ENCH.why = 'already_running';
      else if (nowS - ENCH.lastPlayT <= CFG.entranceCooldownS) ENCH.why = 'cooldown';
      else { ENCH.why = 'started'; enchStartIntro(); }
    }
    if (playing) ENCH.lastPlayT = nowS;
    ENCH.prevPlaying = playing; ENCH.lastT = nowS; ENCH.open = open;
    const I = ENCH.intro;
    if (!rm) {
      ENCH.t += dt;
      // جریانِ اژدها: در خواب خیلی آرام؛ هنگامِ بیدارشدن (swellِ ورود) شتاب می‌گیرد. انتگرال‌گیری ⇒ بدونِ پرش
      ENCH.flow += dt * (0.28 + 2.0 * (I.on ? enchEnvelope(I.t, ENCH_TMP).swell : 0));
    }
    if (I.on) {
      if (rm || !playing && !I.fired && I.t > 0.2 && ENCH.why !== 'preview') { I.on = false; return; }   // مکثِ فوری یا reduced-motion: ورود را رها کن
      I.t += dt;
      if (!I.fired && I.t >= 0.8) {
        I.fired = true;
        // لحظهٔ موجِ اول: ابزارهای موجودِ همین فایل (همانی که کارگردانِ ambient هم صدا می‌زند)، ملایم و با سقفِ سختِ flare
        V.flare = Math.max(V.flare, Math.min(SHOW.flareMax, 0.22));
        V.ejBurst = Math.min(0.5, V.ejBurst + 0.20);
        try {
          if (V.cosmic.sessionActive) {
            const ct = V.cosmic.activeElapsed;
            spawnBloom(ct, 0.60); awakenDistantGroups(ct, 1, 0.4);
            V.cosmic.glow = Math.max(V.cosmic.glow, 0.20);
          }
        } catch (e) {}
      }
      if (I.t >= CFG.entranceS) I.on = false;
    }
  }
  /* uniformهای این فریم، یا null وقتی چیزی برای رسم نیست (پاسِ شیدر کلاً اجرا نمی‌شود). */
  function enchUniforms(idleW) {
    if (!CFG.enchant) return null;
    const o = ENCH_OUT;
    o.aura = clamp(CFG.enchantLevel, 0, 1.2) * idleW;
    if (ENCH.intro.on) enchEnvelope(ENCH.intro.t, o); else { o.swell = 0; o.squeeze = 0; o.r1 = 1; o.a1 = 0; o.r2 = 1; o.a2 = 0; }
    if (o.aura < 0.004 && o.swell < 0.004 && o.a1 < 0.004 && o.a2 < 0.004) return null;
    return o;
  }

  /* رویدادِ بیات هیچ‌وقت نمی‌رسد وقتی stream می‌میرد یا وقتی صدای تازه‌ای وسطِ «مکث» می‌آید.
     این یکی خودمان V.playing را با سیگنال هم‌راستا می‌کند و همان رویدادِ همیشگی را می‌فرستد
     تا بقیهٔ صفحه (starfield، روایتِ دوربین) هم‌وقت شوند. منبعِ محلی هرگز دست‌نخورده می‌ماند.
     HOTFIX: با قاعدهٔ 'or' هرگز «پخش» را وقتی تب در حالِ پخش است یا track زنده است نبندد؛
     و برای اینکه یک خوانشِ لحظه‌ایِ بد (مثلاً stream تازه جاافتاده) کهکشان را نکشد،
     خاموش‌شدن playHoldMs میلی‌ثانیه بعد از آخرین خوانشِ «پخش» اعمال می‌شود. */
  const P = { hiAt: 0, retry: 0 };
  // تصمیمِ «پخش/مکث» هیچ‌وقت داخلِ analyze() یا فریمِ رندر اجرا نمی‌شود (stopLoop وسطِ فریم
  // زنجیرهٔ rAF را به‌هم می‌ریزد): یک ماكروTaskِ کوتاه جلوتر می‌افتد و همان syncPlay می‌خواند.
  function syncPlaySoon(ms) {
    if (P.retry) return;
    P.retry = setTimeout(guard(function () { P.retry = 0; syncPlay(); }, 'to:play-sync'), ms || 0);
  }
  function syncPlayEval() {
    const a = VM.getAudio();
    if (!a || !a.__web) return false;
    const want = playSignal(a), now = performance.now();
    if (want) P.hiAt = now;
    if (CFG.webPlayRule === 'or' && V.playing && !want) {
      const left = CFG.playHoldMs - (now - P.hiAt);
      // پنجرهٔ هیسترزیس: یک خوانشِ بدِ کوتاه پخش را نبندد، ولی قفل هم نکند — دقیقاً سرِ
      // پنجره خودمان دوباره می‌پرسیم (وگرنه باید تا نظرسنجیِ ۳ ثانیه‌ای صبر کرد).
      if (left > 0) { syncPlaySoon(left); return false; }
    }
    if (want === V.playing) return false;
    V.playing = want;
    try { window.dispatchEvent(new CustomEvent('voidmusic:playing', { detail: { playing: want } })); } catch (e) {}
    return true;
  }
  /* §HOTFIX(۲) «گوش‌به‌زنگِ سبک»: وقتی منبعِ تب زنده است ولی حلقهٔ رندر خاموش است، چیزی
     analyze() را صدا نمی‌زند؛ پس بازگشتِ صدا تا نظرسنجیِ ۳ ثانیه‌ای (یا تا یک reportِ بیرونی)
     نمی‌رسد. این تایمر فقط در همان حالت روشن است — rule 'or' + منبعِ تب + !playing + تحلیلگر
     وصل + track زنده — و هر ۴۰۰ms یک نمونهٔ تحلیل (بدون رندر) می‌گیرد؛ به‌محض تغییرِ حالت
     خودش را خاموش می‌کند. منبعِ محلی هرگز این شاخه را نمی‌بیند. */
  const WW = { t: 0, n: 0 };
  function webWatchNeeded() {
    const a = VM.getAudio();
    return CFG.webPlayRule === 'or' && !!(a && a.__web) && !V.playing && !!(A.ok && A.tapped) &&
      streamInfo().liveAny && !(document.hidden && SND.bg !== 'live');
  }
  function webWatchGo() {
    const need = webWatchNeeded();
    if (need && !WW.t) WW.t = setInterval(guard(function () { WW.n++; probeIdle(); syncPlay(); }, 'int:web-watch-400ms'), 400);
    else if (!need && WW.t) { clearInterval(WW.t); WW.t = 0; }
  }
  /* صاحبِ رأیِ بیرونی (report، رویدادِ track، نظرسنجی، streamِ تازه) همیشه از این دروازه
     رد می‌شود، پس «گوش‌به‌زنگ» همیشه با آخرین تصمیم هم‌وقت است. */
  function syncPlay() { const r = syncPlayEval(); webWatchGo(); return r; }

  /* §HOTFIX خودِ track خبر می‌دهد (mute / unmute / ended) — منتظرِ نظرسنجیِ ۳ ثانیه‌ای نمان:
     بلافاصله «پخش» و تحلیلگرها را دوباره ارزیابی کن. muted ترمز نیست؛ فقط یک بازخوانی است. */
  function unwatchTracks() {
    if (!EXT.watch) return;
    EXT.watch.forEach(function (w) { try { w.t.removeEventListener(w.k, w.f); } catch (e) {} });
    EXT.watch = null;
  }
  function watchTracks(stream) {
    unwatchTracks();
    let trs; try { trs = stream.getAudioTracks() || []; } catch (e) { trs = []; }
    const list = [];
    ['mute', 'unmute', 'ended'].forEach(function (kind) {
      trs.forEach(function (t) {
        const f = guard(function () {
          A.trackEv = kind + '@' + Math.round(performance.now());
          syncPlay();                                                    // «پخش» را فوراً بازخوانی کن (muted ترمز نیست)
          refreshTaps();
        }, 'track:' + kind);
        try { t.addEventListener(kind, f); list.push({ t: t, k: kind, f: f }); } catch (e) {}
      });
    });
    EXT.watch = list.length ? list : null;
  }

  function swapSource(newSrc) {
    const N = SNDE.nodes; if (!A.ok || !N || !newSrc) return;
    try { if (A.src) A.src.disconnect(); } catch (e) {}
    A.src = newSrc; N.src = newSrc;
    try { newSrc.connect(A.anE); newSrc.connect(A.anS); } catch (e) {}
    N.mode = ''; applySound(true);
    resetTransient();                                              // منبع جابه‌جا شد: میانگین‌های تطبیقیِ منبعِ قبلی بی‌اعتبار است
  }
  function releaseStream() {
    disarmGestureRetry();
    unwatchTracks();
    if (P.retry) { clearTimeout(P.retry); P.retry = 0; }
    const old = EXT.src; EXT.stream = null; EXT.src = null;
    try { if (old) old.disconnect(); } catch (e) {}
    if (old && A.ok && A.src === old) {
      let el = A.elSrc;
      if (!el) { const a = VM.getLocalAudio && VM.getLocalAudio(); if (a) { try { el = A.elSrc = A.ctx.createMediaElementSource(a); } catch (e) { el = null; } } }
      if (el) { swapSource(el); routeOutput(false); } else { A.src = null; resetTransient(); }
    }
    syncPlay();                                                  // stream رفت: «پخش» دیگر باورپذیر نیست (§1.1)
    if (A.ok) refreshTaps();                                     // درِ تحلیلگر هم منتظرِ نظرسنجیِ ۳s نمی‌ماند
  }
  const webApi = {
    useStream: function (stream) {
      if (EXT.stream && EXT.stream !== stream) releaseStream();
      EXT.stream = stream;
      watchTracks(stream);                                             // §HOTFIX mute/unmute/ended را زنده ببین، نه با نظرسنجی
      if (A.ok && A.ctx) { EXT.src = A.ctx.createMediaStreamSource(stream); swapSource(EXT.src); routeOutput(true); }
      else { A.tries = 0; ensureGraph(); }
      syncPlay();                                                // stream آمد: اگر صفحه «مکث» گزارش کرده بود، تحلیل باید زنده شود (§1.1)
      if (A.ok) refreshTaps();                                   // اتصالِ تحلیلگرها همان لحظهٔ capture، نه تا ۳ ثانیه بعد
    },
    releaseStream: releaseStream,
    active: function () { return !!EXT.stream; },
    /* تشخیصِ صادقانه: «صدا گرفته شد» با «تحلیل در جریان است» یکی نیست. رابطِ کاربری
       فقط وقتی ● می‌زند که واقعاً دادهٔ صوتی به کهکشان می‌رسد. */
    diagnostics: function () {
      const c = A.ctx || A.ctxTry, si = streamInfo(), a = VM.getAudio();
      anRate();
      return {
        graph: A.ok ? 'ready' : (A.state === 'failed' ? 'failed' : 'building'),
        ctx: c ? c.state : 'none',
        stream: si.state, tracks: si.n, trackReady: si.ready, trackMuted: si.muted, streamLive: si.live,
        // §HOTFIX «چرا پخش/چرا نه» با قابل‌خواندنِ هر دو شرط: playWhy یک‌خطِ کامل است
        trackLiveAny: si.liveAny, playRule: CFG.webPlayRule, playHoldMs: CFG.playHoldMs,
        playWhy: playWhy(a), paused: a ? !!a.paused : null, reportedPlaying: !!V.playReported,
        /* §AMBIENT لایهٔ فعلی + دلیل + ضامنِ مخلوط + ساعتِ تازگیِ گزارشِ تب. tier/tierWhy را بدونِ
           حلقهٔ رندر هم می‌خوانیم (tierEval فراخوانیِ بی‌عوارض است) تا چیپِ تشخیص در سکوت هم جواب بدهد. */
        tier: (V.running ? V.tier : tierEval(a).tier), tierWhy: (V.running ? V.tierWhy : tierEval(a).why),
        tierX: Math.round(V.tierX * 100) / 100, lastWebStateAgeMs: webReportAgeMs(a),
        webFallback: CFG.webFallback, webFreshMs: CFG.webFreshMs,
        /* §IDLE حالتِ «صدا هست، منبعِ موسیقی نیست». on = رأیِ همین لحظه، why = دلیلِ خوانا از
           idleAudioEval (هرگز حدس نیست: از activeInfo.audioOnlyِ لایهٔ منبع می‌آید)، x = ضامنِ
           crossfade. هیچ عددی از اینجا ادعایِ تحلیلِ موسیقی نمی‌کند و quality را لمس نمی‌کند. */
        idleHalo: { on: !!V.idleAudio, flag: !!CFG.idleHalo, x: Math.round(V.idleX * 100) / 100,
          why: V.idleWhy, level: Math.round(idleHaloLevel() * 1000) / 1000, fadeS: CFG.idleHaloFadeS,
          taps: !!(A.ok && A.tapped) },
        /* §SCENE مدلِ سه‌حالتیِ نمایش: vstate = idle | source | playing. source یعنی «منبعِ
           شناسایی‌شده، پخشِ تأییدشده نیست» — هیچ‌وقت جای playing را نمی‌گیرد و quality را لمس
           نمی‌کند. why = دلیلِ رأی از scenePoll، awakenX = ضامنِ گذارِ بیداریِ دیسکِ موجود. */
        scene: { flag: !!CFG.scene, vstate: V.vstate, why: V.sceneWhy, srcKind: V.srcKind,
          idleX: Math.round(V.idleX * 100) / 100, awakenX: Math.round(V.awakenX * 100) / 100,
          level: Math.round(awakenTarget() * 1000) / 1000, fadeS: CFG.awakenFadeS,
          wanted: !!sceneWanted(), stillPainted: !!V.sceneStill },
        /* §SHOW «کارگردانِ» ambient: روشن/خاموش، پردهٔ فعلی، زمانِ نمایش، شدتِ نورِ لحظه، seedِ
           آهنگ و شمارشِ افکت‌ها. همه آرایشی‌اند: هیچ‌کدام از دادهٔ صوتی نمی‌آید و هیچ‌کدام
           quality را از 'ambient' بیرون نمی‌آورد (چیپ در این لایه هرگز «live» نمی‌گوید). */
        show: { on: !!V.show.on, flag: !!CFG.ambientShow, level: Math.round(V.show.level * 100) / 100,
          phase: V.show.phase, t: Math.round(V.show.t * 10) / 10, env: Math.round(V.show.env * 1000) / 1000,
          hueIdx: V.show.hueIdx, seed: V.show.seed, seedSrc: String(V.show.seedSrc).slice(0, 60),
          begins: V.show.begins, nComet: V.show.nComet, nBloom: V.show.nBloom, nWake: V.show.nWake,
          nFlight: V.show.nFlight, nFlightNoStars: V.show.nFlightNoStars, nSurge: V.show.nSurge,
          nSurgeNoGate: V.show.nSurgeNoGate, maxEnvRate: Math.round(V.show.maxEnvRate * 100) / 100,
          density: Math.round(showDensity() * 100) / 100 },
        trackEvent: A.trackEv || '', listeners: EXT.watch ? EXT.watch.length : 0,
        // §HOTFIX(۲) «گوش‌به‌زنگ» و اجازهٔ suspend: دو شرطی که بیدار-ماندنِ تحلیل را تعیین می‌کنند
        webWatch: WW.t ? 'on' : 'off', webWatchSamples: WW.n, suspendAllowed: suspendAllowed(a),
        tapped: !!(A.ok && A.tapped), tapsWhy: A.tapsWhy || '',
        hidden: !!document.hidden, bgMode: SND.bg,
        playing: !!V.playing, reported: !!V.playReported,
        /* fpsِ واقعیِ analyze() روی پنجرهٔ ۵ ثانیه: raf = حلقهٔ رندر، bg = pumpِ پس‌زمینه/orb.
           «تحلیلِ زنده» را با فریم‌ریتِ رندر اشتباه نگیرید — این دو عدد جدا شمرده می‌شوند. */
        analyzeAgoMs: AN.lastAt ? Math.round(performance.now() - AN.lastAt) : -1,
        /* runs = شمارشِ انباشتهٔ واقعاً-اجراشده؛ در مرورگرِ واقعی analyzeAgoMs/fps را بخوانید
           (sandboxِ آزمون performance.now را بی‌حرکت نگه می‌دارد، پس این دو بی‌معنی می‌شوند). */
        runsRaf: AN.raf, runsBg: AN.bg,
        fpsRaf: Math.round(AN.fpsRaf * 10) / 10, fpsBg: Math.round(AN.fpsBg * 10) / 10, fpsWindowS: 5,
        replay: !!(A.ok && !A.web),            //Void Tab خودش هم صدا پخش می‌کند (فقط منبعِ محلی)
        db: A.db, silent: !!A.silent, tries: A.tries, quality: FEAT.quality,
        /* §0 حلقهٔ خطا: تازه‌ترین ۴۰ خطای ثبت‌شدهٔ تایمرها/صفحه (بدونِ تغییرِ رفتار) */
        errors: ERR.ring.slice(), errTotal: ERR.n
      };
    }
  };

  /* مسیرِ خروجی: منبعِ محلی از اکولایزرِ اصلی به اسپیکرِ Void Tab می‌رود. منبعِ تب
     (chrome.tabCapture) باید *تحلیل* شود، نه دوباره پخش: همان صدا در تبِ خودش می‌آید و
     عبورِ مجدد از destination اکو و تأخیر می‌سازد («تبِ قدیمی صدای تبِ جدید را پخش می‌کند»).
     یک گرهٔ بی‌صدا به destination وصل می‌ماند تا گراف همچنان رندر شود. */
  function routeOutput(web) {
    if (!A.ctx || !A.gain) return;
    try { A.gain.disconnect(); } catch (e) {}
    if (web) {
      if (!A.sink) { A.sink = A.ctx.createGain(); A.sink.gain.value = 0; A.sink.connect(A.ctx.destination); }
      A.gain.connect(A.sink);
    } else {
      A.gain.connect(A.ctx.destination);
    }
    A.web = !!web;
  }

  /* context به‌دلیلِ سیاستِ autoplay اجرا نشده؟ پس این شکستِ گراف نیست و نباید برای
     همیشه کنار گذاشته شود: اولین ژستِ واقعیِ کاربر (کلیک/کلید در همین صفحه) گراف را
     می‌سازد. بدونِ این حلقه، «chip متصل — کهکشان بی‌حرکت» برگشت‌ناپذیر می‌ماند. */
  function armGestureRetry() {
    if (A.gestureArmed || !EXT.stream) return;
    A.gestureArmed = true;
    A.retryGo = function () {
      document.removeEventListener('pointerdown', A.retryGo, true);
      document.removeEventListener('keydown', A.retryGo, true);
      A.retryGo = null; A.gestureArmed = false; A.tries = 0;
      ensureGraph().then(function (ok) { if (ok) { refreshTaps(); A.snap = true; } });
    };
    document.addEventListener('pointerdown', A.retryGo, true);
    document.addEventListener('keydown', A.retryGo, true);
  }
  /* منبعی که رفته، ژستِ معطلِ آن هم نباید بماند: وگرنه gestureArmed روی true قفل می‌کند
     و منبعِ بعدی هیچ‌وقت فرصتِ تلاشِ دوباره نمی‌گیرد. */
  function disarmGestureRetry() {
    if (!A.gestureArmed) return;
    if (A.retryGo) {
      document.removeEventListener('pointerdown', A.retryGo, true);
      document.removeEventListener('keydown', A.retryGo, true);
    }
    A.retryGo = null; A.gestureArmed = false;
  }

  /* معلق موندنِ گراف فقط با یک ژستِ *داخلِ همین صفحه* باز نمی‌شود: کاربر تب را از نوارِ
     تب‌ها انتخاب می‌کند و آن کلیک هرگز به این صفحه نمی‌رسد. پس خودِ «جلو آمدنِ تب» را
     فرصتِ ادامه می‌گیریم: اگر تلاشی معطل است همین‌جا مصرف می‌شود، وگرنه یک بودجهٔ تازه
     برای ساختِ گراف. رد شدنِ تلاش چیزی را جا نمی‌گذارد جز یک ژستِ دوبارهarmed. */
  function recoverOnReturn() {
    if (!V.playing) return;
    if (!A.ok || (A.ctx && A.ctx.state !== 'running')) {
      if (A.retryGo) A.retryGo();
      else {
        A.tries = 0;
        ensureGraph().then(function (ok) { if (ok) { refreshTaps(); A.snap = true; } });
      }
    }
    if (!V.running && V.playing) startLoop();
  }

  async function ensureGraph() {
    if (A.ok) { if (A.ctx.state !== 'running') { try { await A.ctx.resume(); } catch (e) {} } return true; }
    if (A.tries >= 6) { armGestureRetry(); return false; }
    const audio = VM.getAudio();
    if (!audio) return false;
    if (audio.__web && !EXT.stream) return false;     // منبعِ وب بدونِ صدای واقعیِ تب: تحلیل نداریم (حالتِ محیطیِ دکوراتیو)؛ شمارندهٔ تلاش را هم نمی‌سوزاند
    A.tries++;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      let ctx = A.ctxTry && A.ctxTry.state !== 'closed' ? A.ctxTry : new AC({ latencyHint: 'playback' });
      A.ctxTry = ctx;
      try { await ctx.resume(); } catch (e) {}
      // اگر context اجرا نشد، المنتِ صدا را «نمی‌دزدیم» تا پخش بی‌صدا نشود؛ دفعهٔ بعد (با یک کلیکِ دیگر) دوباره امتحان می‌شود
      if (ctx.state !== 'running') { armGestureRetry(); return false; }
      const web = !!audio.__web;
      const src = A.src || (A.src = web ? (EXT.src = ctx.createMediaStreamSource(EXT.stream)) : (A.elSrc = ctx.createMediaElementSource(audio)));      // منبعِ المنت نباید دوبار ساخته شود
      const anE = ctx.createAnalyser(); anE.fftSize = 2048; anE.smoothingTimeConstant = 0;
      const anS = ctx.createAnalyser(); anS.fftSize = 4096; anS.smoothingTimeConstant = 0.3;
      const gain = ctx.createGain();
      src.connect(anE); src.connect(anS);
      buildSoundChain(ctx, src, gain);
      VM.setOutputGain(gain);
      // پایداری: اگر مرورگر context را وسطِ پخش معلق کرد (سیاست‌های خودکار/سیستم)، صدا قطع می‌شود؛ بلافاصله ادامه بده
      ctx.onstatechange = function () {
        const a = VM.getAudio();
        if (ctx.state !== 'running' && playSignal(a)) { try { ctx.resume(); } catch (e) {} armGestureRetry(); }
        else if (ctx.state === 'running') { A.snap = true; refreshTaps(); }   // از سرِ معلق بودن برگشت: میانگین‌های تطبیقی دوباره کالیبره شوند
      };
      A.tapped = true;
      A.ctx = ctx; A.anE = anE; A.anS = anS; A.gain = gain; A.sr = ctx.sampleRate;
      routeOutput(web);                                            // بعد از نشستنِ A.ctx/A.gain: پیش از این، مسیرِ خروجی در ساختِ نخستین گراف هرگز برقرار نمی‌شد
      A.tBuf = new Float32Array(anE.fftSize);
      A.fE = new Float32Array(anE.frequencyBinCount); A.prevE = new Float32Array(anE.frequencyBinCount);
      A.fS = new Float32Array(anS.frequencyBinCount);
      A.kEHi = Math.min(A.fE.length - 1, Math.floor(9000 / (A.sr / anE.fftSize)));
      const eBinHz = A.sr / anE.fftSize;
      A.kLowEnd = clamp(Math.floor(180 / eBinHz), 1, A.kEHi);
      A.kMidEnd = clamp(Math.floor(2000 / eBinHz), A.kLowEnd + 1, A.kEHi);
      A.kBass = Math.max(1, Math.floor(150 / eBinHz));                             // باندِ باس ۲۰–۱۵۰Hz؛ با fftSize=2048 در ۴۸kHz ≈ ۶ bin (از ≈۲۳Hz)
      // جدولِ bin → کلاسِ نت (وزنِ مثلثی: ۱ روی نیم‌پردهٔ دقیق، ۰ در وسطِ دو نیم‌پرده)
      const binHz = A.sr / anS.fftSize;
      A.kLo = Math.ceil(130 / binHz); A.kHi = Math.min(A.fS.length - 2, Math.floor(4200 / binHz));
      A.kC0 = Math.ceil(110 / binHz); A.kC1 = Math.min(A.fS.length - 2, Math.floor(9000 / binHz));
      A.pcIdx = new Uint8Array(A.fS.length); A.pcW = new Float32Array(A.fS.length); A.bandIdx = new Uint8Array(A.fS.length);
      for (let k = 1; k < A.fS.length; k++) {
        const f = k * binHz;
        const midi = 69 + 12 * Math.log2(f / 440), n = Math.round(midi);
        A.pcIdx[k] = ((n % 12) + 12) % 12;
        A.pcW[k] = Math.max(0, 1 - Math.abs(midi - n) * 2);
        A.bandIdx[k] = clamp(Math.floor(Math.log(f / 110) / Math.log(9000 / 110) * 12), 0, 11);
      }
      A.ok = true; A.state = 'ok'; A.tries = 0;
      return true;
    } catch (e) { A.state = 'failed'; return false; }
  }

  function tapSet(on) {
    if (!A.ok || A.tapped === on) return;
    if (on) {
      if (!A.src) return;                                        // منبعی نیست که وصل شود: درِ تحلیل باز نمی‌شود (tapped دروغ نمی‌گوید)
      try { A.src.connect(A.anE); A.src.connect(A.anS); A.tapped = true; } catch (e) {}
      resetTransient();
      return;
    }
    /* §HOTFIX: جداکردنِ نودِ رفته خطا می‌دهد. آن خطا نباید باعث شود «وصل» باقی بماند:
       tapped در diagnostics و در silenceMeasured() خوانده می‌شود، پس باید صادق باشد. */
    try { if (A.src) { A.src.disconnect(A.anE); A.src.disconnect(A.anS); } } catch (e) {}
    A.tapped = false;
  }
  function tapsWanted() {
    const a = VM.getAudio();
    if (!a) { A.tapsWhy = 'no_element'; return false; }
    /* §IDLE: منبعِ «صدا بدونِ موسیقی» تحلیل نمی‌شود — نه به‌خاطرِ هزینه، به‌خاطرِ صداقت: هیچ چیز
       در این حالت نباید با دادهٔ آن حرکت کند و چیپ هم باید «linked ولی بدونِ تحلیلِ موسیقی» بگوید
       (analysisState از tapped می‌خواند → 'untapped'). فقط منبعِ وب؛ فایلِ محلی دست‌نخورده.
       درِ پخش/سکوتِ اندازه‌گرفته‌شده به تحلیلگرِ وصل وابسته است (silenceMeasured → A.tapped) و
       با بسته‌بودنِ تحلیلگرها قفلِ «سکوتِ بیات» نمی‌سازد، پس playSignal مثلِ قبل رأی می‌گیرد. */
    if (CFG.idleHalo && a.__web && V.idleAudio) { A.tapsWhy = 'audio_only_source'; return false; }
    // §1.1 + HOTFIX منبعِ تب: تا stream زنده است تحلیلگرها وصل می‌مانند (سکوت/پخش اندازه گرفته می‌شود،
    // از پرچمِ muted یا pausedِ کاذب نتیجهٔ تاریک نمی‌گیریم)؛ منبعِ محلی مثلِ قبل.
    if (!tapsSignal(a)) {
      // دلیل باید همان چیزی باشد که رأی آورده: در 'legacy' صاحبِ رأی paused است، نه stream.
      A.tapsWhy = (a.__web && CFG.webPlayRule !== 'legacy') ? 'stream_not_live' : 'paused';
      return false;
    }
    if (document.hidden && SND.bg !== 'live') { A.tapsWhy = 'hidden'; return false; }      // تبِ پنهان: فقط صدا (تحلیلگرها جدا می‌شوند)
    const vis = VM.isOpen() || !!(VM.isMiniVisible && VM.isMiniVisible() && !document.hidden) || !!(VM.remoteWanted && VM.remoteWanted());
    A.tapsWhy = vis ? 'wanted' : 'not_visible';
    return vis;
  }
  function refreshTaps() { tapSet(tapsWanted()); webWatchGo(); }
  /* §HOTFIX وقتی تب «مکث» گزارش می‌کند ولی stream زنده است، حلقهٔ رندر خاموش است و کسی
     analyze() را صدا نمی‌زند — پس سکوت *اندازه گرفته نمی‌شود* و قاعدهٔ fail-open در «مکثِ
     کاذب» قفل می‌کرد. این یکی همان کاری را می‌کند که bgKick در تبِ پنهان می‌کند: یک نمونهٔ
     تحلیل بدونِ رندر، تا تصمیم بعدی بر پایهٔ RMS باشد نه بر پایهٔ خوانشِ بیات. */
  function probeIdle() {
    const a = VM.getAudio();
    if (!a || !a.__web || V.playing || !A.ok || !A.tapped) return;
    if (CFG.webPlayRule === 'legacy' || !streamInfo().liveAny) return;
    if (document.hidden && SND.bg !== 'live') return;             // قاعدهٔ تبِ پنهان دست‌نخورده: تحلیل نکن
    try { anCount(true); analyze(0.17, true); } catch (e) { errPush('probe:analyze', e); }
  }
  setInterval(guard(function () {
    idleHaloCheck();                                               // §IDLE رأیِ «صدا بدونِ موسیقی» + بیدارکردنِ حلقه (تایمرِ تازه نمی‌سازیم)
    if (A.ok) refreshTaps();
    probeIdle();                                                 // §HOTFIX سکوتِ اندازه‌گرفته‌شده را از reportِ کاذب جدا کن
    syncPlay();                                                  // §1.1 اگر رویدادی برای مرگِ stream نیامد، خودمان درِ تحلیل را می‌بندیم/باز می‌کنیم
  }, 'int:reconcile-3s'), 3000);

  // توانِ میانگینِ یک گروه bin → dBFS (همان مقیاسی که پنجره‌های بانده در آن تنظیم شده‌اند)
  function bandDb(power, count) { return 10 * Math.log10(power / Math.max(1, count) + 1e-12); }
  function spectralLevel(db, floorDb, ceilingDb, normDb) {
    const x = clamp((db + (normDb || 0) - floorDb) / (ceilingDb - floorDb), 0, 1);
    return x * x * (3 - 2 * x);
  }

  /* §1.6 شمارشِ خودِ analyze() — «تحلیلگر وصل است» با «تحلیل اجرا می‌شود» یکی نیست.
     raf = حلقهٔ اصلیِ رندر، bg = pumpِ پس‌زمینه (~۶Hz) و orb کوچک. سبدِ یک‌ثانیه‌ای و
     پرسشِ تنبل (فقط داخل diagnostics) تا هیچ هزینه‌ای در مسیرِ گرمِ فریم نیفتد. */
  const AN = { cur: null, buckets: [], lastAt: 0, raf: 0, bg: 0, fpsRaf: 0, fpsBg: 0 };
  function anCount(fromBg) {
    const now = performance.now();
    AN.lastAt = now;
    if (!AN.cur || now - AN.cur.t >= 1000) {
      if (AN.cur) { AN.buckets.push(AN.cur); while (AN.buckets.length > 6) AN.buckets.shift(); }
      AN.cur = { t: now, n: 0, b: 0 };
    }
    if (fromBg) { AN.cur.b++; AN.bg++; } else { AN.cur.n++; AN.raf++; }
  }
  function anRate() {
    const now = performance.now();
    let n = 0, b = 0, from = now, any = false;
    if (AN.cur) { n += AN.cur.n; b += AN.cur.b; from = AN.cur.t; any = true; }
    for (let i = 0; i < AN.buckets.length; i++) {
      const k = AN.buckets[i];
      if (now - k.t > 5000) continue;
      n += k.n; b += k.b; any = true;
      if (k.t < from) from = k.t;
    }
    if (!any) { AN.fpsRaf = 0; AN.fpsBg = 0; return; }
    const span = Math.min(5, Math.max(0.5, (now - from) / 1000));
    AN.fpsRaf = n / span; AN.fpsBg = b / span;
  }

  // یک بار در هر فریمِ رندر: انرژی/فلاکس (همیشه) + طیف/کروما (فقط وقتی کهکشان دیده می‌شود)
  function analyze(dt, needSpec) {
    const E = A.anE;
    E.getFloatTimeDomainData(A.tBuf);
    let ss = 0; const tb = A.tBuf, n = tb.length;
    for (let i = 0; i < n; i++) ss += tb[i] * tb[i];
    const db = 20 * Math.log10(Math.sqrt(ss / n) + 1e-7);
    const wasSilent = A.silent;
    if (A.snap && db > -80) { A.db = db; A.base = db; A.snap = false; A.warm = 1.5; A.pk = db + 3; A.fl = db - 3; A.fSeed = true; A.fluxBase = FLUX_SEED; }
    A.db += (db - A.db) * expK(dt, 0.12);
    A.silent = A.db < -66;
    A.measured++;                                                // §HOTFIX: «سکوت» فقط با شواهدِ اندازه‌گرفته‌شده باورپذیر است
    if (CFG.webPlayRule === 'or' && A.silent !== wasSilent) syncPlaySoon(0);   // «پخش/مکث» روی همان لحظهٔ تغییرِ سکوت تصمیم می‌گیرد، نه تا نظرسنجیِ ۳s

    E.getFloatFrequencyData(A.fE);
    let hi = 0, all = 0, allPrev = 0;
    let lowPower = 0, midPower = 0, highPower = 0, lowCount = 0, midCount = 0, highCount = 0, bassPower = 0, bassCount = 0;
    const k2k = Math.floor(2000 / (A.sr / A.anE.fftSize));
    const C = 0.11512925;                                        // ln(10)/20 : dB → دامنهٔ خطی
    for (let k = 1; k <= A.kEHi; k++) {
      const m = Math.exp(A.fE[k] * C);
      if (k >= 2) { all += m; if (k >= k2k) hi += m; allPrev += Math.exp(A.prevE[k] * C); }
      if (k <= A.kBass) { bassPower += m * m; bassCount++; }
      if (k <= A.kLowEnd) { lowPower += m * m; lowCount++; }
      else if (k <= A.kMidEnd) { midPower += m * m; midCount++; }
      else { highPower += m * m; highCount++; }
    }
    A.bright += ((all > 0 ? hi / all : 0) - A.bright) * expK(dt, 0.5);
    A.tAcc += dt;

    // فلاکسِ «شکلِ طیف» (بی‌بُعد): هر bin بر حسبِ سهمش از کلِ انرژی، و سپس مجموعِ افزایش‌های مثبت.
    // گامِ حجمی (ولومِ سیستم/آنمیوت/پرشِ مستر) سهم‌ها را تغییر نمی‌دهد ⇒ فلاکس دقیقاً صفر، پس
    // بلندیِ بیشتر خودش ضرب حساب نمی‌شود؛ فقط تغییرِ توزیعِ انرژِ (کوک/استیک/بیس) نسبت را بالا می‌برد.
    const invAll = all > 1e-12 ? 1 / all : 0, invPrev = allPrev > 1e-12 ? 1 / allPrev : 0;
    let flux = 0;
    for (let k = 2; k <= A.kEHi; k++) {
      const m = Math.exp(A.fE[k] * C) * invAll, p = Math.exp(A.prevE[k] * C) * invPrev;
      if (m > p) flux += m - p;
    }
    A.prevE.set(A.fE);
    const fluxN = A.silent ? 0 : flux;
    // غلبهٔ بیس: توانِ میانگینِ ۲۰–۱۵۰Hz تقسیم بر توانِ میانگینِ بقیهٔ طیف — شکلِ طیف، نه بلندیِ آن.
    const bassMean = bassPower / Math.max(1, bassCount);
    const restDen = (lowCount - bassCount) + midCount + highCount;
    const restMean = (lowPower - bassPower + midPower + highPower) / Math.max(1, restDen);
    const bassN = (A.silent || restMean < 1e-14) ? 0 : bassMean / restMean;
    // بازگشت از سکوت یک گسست است، نه ضرب: پایه‌ها از نو کالیبره و پنجرهٔ گرمایش کوتاه می‌شود
    if (wasSilent && !A.silent) { A.fSeed = true; A.warm = Math.max(A.warm, 0.35); }
    if (A.fSeed && !A.silent) { A.fluxBase = Math.max(fluxN, 1e-4); A.bassAvg = Math.max(bassN, 1e-4); A.fSeed = false; }
    A.bassRatio += (bassN - A.bassRatio) * expK(dt, 0.6);
    A.prevFluxR = A.fluxR;
    if (!A.silent) {
      A.fluxBase += (fluxN - A.fluxBase) * expK(dt, 4);
      A.fluxR += (fluxN / (A.fluxBase + 1e-9) - A.fluxR) * expK(dt, 0.1);
    }
    // ضربانِ باس: قلهٔ نسبتِ غلبهٔ بیس در برابرِ میانگینِ متحرکِ همان نسبت (نه آستانهٔ ثابتِ dB)
    A.bassBeat = false;
    if (!A.snap && !A.silent && A.warm <= 0 && bassN > A.bassAvg * 1.45 + 1e-4 && bassN > A.bassPrev * 1.05 && A.tAcc - A.lastBass > 0.28) { A.bassBeat = true; A.lastBass = A.tAcc; }
    A.bassAvg += (bassN - A.bassAvg) * expK(dt, 1.2); A.bassPrev = bassN;

    // خطِ پایهٔ کندِ «بلندیِ همین آهنگ»: بالا رفتنش آهسته، پایین آمدنش سریع‌تر
    let tau = A.db > A.base ? 30 : 10;
    if (A.warm > 0) { A.warm -= dt; tau = 1.2; }
    if (!A.silent) A.base += (A.db - A.base) * expK(dt, tau);
    // پاکت‌های قله/کفِ «همین آهنگ» (حمله سریع، رها شدن بسیار کند) → انرژی نسبت به بازهٔ پویاییِ خودِ آهنگ؛
    // آهنگ‌های فشرده/ملایم هم دامنهٔ کامل را می‌بینند (حداقل بازهٔ ۶dB تا نویز بزرگ نشود)
    if (!A.silent) {
      A.pk += (A.db - A.pk) * expK(dt, A.db > A.pk ? 0.25 : 25);
      A.fl += (A.db - A.fl) * expK(dt, A.db < A.fl ? 0.25 : 25);
    }
    const dr = Math.max(6, A.pk - A.fl);
    // نسبت به «وسطِ بازهٔ پویاییِ همین آهنگ»: آهنگِ یکنواخت ≈۰٫۵؛ اوج‌ها بالاتر، بخش‌های آرام پایین‌تر
    A.en = A.silent ? 0 : clamp(0.5 + (A.db - (A.pk + A.fl) / 2) / dr, 0, 1);
    const abs = clamp((A.db + 50) / 42, 0, 1);                       // بلندیِ مطلق: ‑۵۰dBFS→۰ ، ‑۸dBFS→۱
    // چرا این بازه: موسیقیِ واقعاً مستر‌شده (استریم/فایل) تقریباً بین ‑۲۵ تا ‑۹dBFS جا می‌گیرد.
    // با سقفِ قبلی (‑۱۸dBFS→۱) هر آهنگِ معمولی روی ۱ می‌چسبید و انرژی ≈۰٫۹ ثابت می‌شد: کهکشان
    //ِ آروم و پرانرژی یکی می‌شد و ماشینِ calm/galaxy هرگز خارج نمی‌شد. با این منحنی، بلندترین
    // آهنگ همان پرنوریِ همیشگی می‌گیرد (abs≈۰٫۹۸) و آهنگِ آرام واقعاً ملایم‌تر می‌شود (abs≈۰٫۶).
    // زیرِ ‑۳۳dBFS منحنیِ تازه مقدارِ منحنیِ قبلی را دقیقاً حفظ می‌کند، پس رفتارِ صداهای ضعیف عوض نشده است.
    // صداهای ضعیف (abs کم) → شفق جلو؛ صداهای قوی → کهکشان. آهنگِ بلندِ یکنواخت هم همیشه به کهکشان می‌رسد
    A.energy = A.silent ? 0 : clamp(Math.max(A.en * (0.5 + 0.65 * abs), abs * 0.8) * CFG.sens, 0, 1);

    // Three smoothed spectral layers share the existing analyser pass: bass → core,
    // mids → disk density waves, highs → sparse stellar glints.
    // آروانهٔ یک‌طرفه، اما با خط‌کشِ *خودِ طیف*: معیارِ کمبود، بلندترین بانده (نه قلهٔ دامنهٔ زمانی،
    // که حدود ۲۵dB پایین‌تر از همان اطلاعات را روی مقیاسی دیگر می‌خواند و آروانه را بیش از حد
    // درگیر می‌کرد؛ نتیجه: همهٔ باندها به سقف می‌چسبیدند و شکلِ طیفِ آهنگ‌های آرام صاف می‌شد).
    // هدف ‑۴۶dBFS وسطِ پنجرهٔ نگاشتِ باندهاست، پس جبرانِ کمبود نور را «به میانه» می‌آورد و
    // فاصلهٔ باندها از هم (همان هویتِ آهنگ) دست‌نخورده می‌ماند؛ پخشِ معمول اصلاً درگیر نمی‌شود.
    const lowRaw = bandDb(lowPower, lowCount), midRaw = bandDb(midPower, midCount), highRaw = bandDb(highPower, highCount);
    if (!A.silent) A.bandNorm += (clamp(BAND_AGC_TARGET - Math.max(lowRaw, midRaw, highRaw), 0, 24) - A.bandNorm) * expK(dt, 3);
    const lowTarget = A.silent ? 0 : spectralLevel(lowRaw, -72, -30, A.bandNorm);
    const midTarget = A.silent ? 0 : spectralLevel(midRaw, -68, -28, A.bandNorm);
    const highTarget = A.silent ? 0 : spectralLevel(highRaw, -78, -38, A.bandNorm);
    A.low += (lowTarget - A.low) * expK(dt, lowTarget > A.low ? 0.18 : 0.72);
    A.mid += (midTarget - A.mid) * expK(dt, midTarget > A.mid ? 0.20 : 0.78);
    A.high += (highTarget - A.high) * expK(dt, highTarget > A.high ? 0.12 : 0.62);

    if (!needSpec) return;
    const S = A.fS; A.anS.getFloatFrequencyData(S);
    // قله‌یابیِ کروما
    let mx = -200;
    for (let k = A.kLo; k <= A.kHi; k++) if (S[k] > mx) mx = S[k];
    const raw = A.raw; raw.fill(0);
    const thr = mx - 38;
    for (let k = A.kLo; k <= A.kHi; k++) {
      const v = S[k];
      if (v < thr || !(v >= S[k - 1] && v > S[k + 1])) continue;
      raw[A.pcIdx[k]] += Math.exp(v * 0.11512925) * A.pcW[k];
    }
    let rmax = 0, rsum = 0;
    for (let i = 0; i < 12; i++) { if (raw[i] > rmax) rmax = raw[i]; rsum += raw[i]; }
    // اطمینانِ کروما: نویز/ضرب (تخت) → ۰ ؛ نتِ مشخص → ۱
    const share = rsum > 0 ? rmax / rsum : 0;
    const conf = A.silent ? 0 : clamp((share - 0.14) / 0.3, 0, 1);
    A.conf += (conf - A.conf) * expK(dt, 0.25);
    // سنتروید + باندهای لگاریتمی (جایگزینِ صادقانه وقتی کروما قابل‌اعتماد نیست)
    const band = A.band; band.fill(0);
    let cNum = 0, cDen = 0; const binHz = A.sr / A.anS.fftSize;
    for (let k = A.kC0; k <= A.kC1; k++) {
      const m = Math.exp(S[k] * 0.11512925);
      band[A.bandIdx[k]] += m; cNum += k * binHz * m; cDen += m;
    }
    let bmax = 0; for (let i = 0; i < 12; i++) if (band[i] > bmax) bmax = band[i];
    if (cDen > 0 && !A.silent) {
      const c = cNum / cDen, r = clamp(Math.log2(c / 150) / Math.log2(6000 / 150), 0, 1);
      A.centroidR += ((0.12 + 0.68 * r) - A.centroidR) * expK(dt, 0.4);
    }
    const gate = A.silent ? 0 : 1;
    for (let i = 0; i < 12; i++) {
      const cN = rmax > 0 ? raw[i] / rmax : 0;
      const bN = bmax > 0 ? band[i] / bmax : 0;
      const target = gate * Math.pow(A.conf * cN + (1 - A.conf) * bN * 0.8, 1.5);
      const cur = A.chroma[i];
      A.chroma[i] = cur + (target - cur) * expK(dt, target > cur ? 0.08 : 0.22);
    }
  }

  /* ------------------------------------------------------------------ */
  /* رابطهِ تحلیل ← رندر (FEAT)                                           */
  /* ------------------------------------------------------------------ */
  /* تحلیل فقط این شیء را می‌سازد و رندر فقط از همین می‌خواند؛ هیچ تابعِ تحلیلی داخلِ
     مسیرِ رسم نیست. quality صادقانه می‌گوید دادهٔ صوتی واقعی است یا نه:
       'live'    آنالایزر زنده و سیگنال بالاتر از آستانهٔ سکوت
       'silent'  پخش برقرار است ولی سیگنال زیرِ آستانهٔ سکوت است (ویژگی‌ها صفر می‌شوند)
       'idle'    پخش متوقف/یافت‌نشده است
       'ambient' آنالیز در دسترس نیست (context اجرا نشد) ⇒ فقط جایگزینِ تزئینی
     در سه وضعیتِ آخر هیچ ضربه/پالسِ «موسیقی‌ای» ساخته نمی‌شود. */
  const FEAT = {
    quality: 'ambient', live: false,
    bass: 0, mid: 0, treble: 0, bassDom: 0, energy: 0, fluxR: 1,
    onset: false, onsetStrength: 0, beat: false,
    conf: 0, centroidR: 0.4, bright: 0.2, silent: true, db: -90,
    lastOnsetAt: -9
  };
  const ONSET_REFRACTORY_S = 0.30;                  // حداکثر ~۳٬۳ ضربه در ثانیه (صدای تند هم پالسی نمی‌شود)
  function updateFeatures(dt, playing, nowS) {
    // §AMBIENT لایهٔ ambient یعنی «دادهٔ واقعی به تحلیلگر نمی‌رسد» (track مرده + گرافِ قدیمی،
    // یا گرافِ نساخته). پیش‌تر FEAT.live فقط از شواهدِ خودِ گراف (A.ok) می‌آمد و در حالتِ
    // «گراف هست ولی stream مُرده» می‌توانست true بماند درحالی‌که quality همان لحظه 'ambient'
    // می‌گفت — دو ادعای متناقض در یک خوانش. حالا هر دو از یک منبع تصمیم می‌آیند.
    // زیرِ webFallback='off' لایه جز در نبودِ گراف 'ambient' نمی‌شود (شرطِ tierEval)، پس این
    // شرط با A.ok یکی است و نقشهٔ live دقیقاً همان عبارتِ قبلی می‌ماند.
    FEAT.live = !!(A.ok && playing && !A.silent) && V.tier !== 'ambient';
    FEAT.quality = (!A.ok || V.tier === 'ambient') ? 'ambient' : (!playing ? 'idle' : (A.silent ? 'silent' : 'live'));
    const stable = FEAT.live && A.warm <= 0;        // پنجرهٔ گرمایش: جابه‌جاییِ منبع/آهنگ ضربهٔ کاذب نمی‌سازد
    FEAT.bass = FEAT.live ? A.low : 0;
    FEAT.mid = FEAT.live ? A.mid : 0;
    FEAT.treble = FEAT.live ? A.high : 0;
    FEAT.bassDom = stable ? clamp(A.bassRatio * 0.5, 0, 1) : 0;
    FEAT.energy = A.ok ? A.energy : 0;
    FEAT.fluxR = A.ok ? A.fluxR : 1;
    FEAT.db = A.db; FEAT.silent = A.silent;
    FEAT.conf = A.ok ? A.conf : 0; FEAT.centroidR = A.centroidR; FEAT.bright = A.bright;
    // دو مسیرِ مستقلِ onset: شارِ طیفی (تغییرِ زمانیِ طیف) و قلهٔ غلبهٔ بیس. هیچ‌کدام «افزایشِ حجم» نیست.
    const fluxCross = stable && A.fluxR >= 1.7 && A.prevFluxR < 1.7;
    FEAT.beat = stable && A.bassBeat;
    FEAT.onset = false; FEAT.onsetStrength = 0;
    if ((fluxCross || FEAT.beat) && nowS - FEAT.lastOnsetAt > ONSET_REFRACTORY_S) {
      FEAT.onset = true; FEAT.lastOnsetAt = nowS;
      const shape = clamp((A.fluxR - 1) * 0.35, 0, 0.55);
      FEAT.onsetStrength = clamp(shape + (FEAT.beat ? 0.18 : 0) + 0.10 * FEAT.bassDom, 0.22, 0.75);
    }
  }
  // منبعِ تازه یا آهنگِ تازه: میانگین‌های تطبیقی را پاک می‌کند. بی‌این کار یک جابه‌جاییِ منبع
  // چند ثانیه فلاکسِ کاذب تولید می‌کرد (prevE از طیفِ منبعِ قبلی بود).
  function resetTransient() {
    if (A.prevE && A.fE) A.prevE.set(A.fE);
    A.snap = true; A.warm = 1.5; A.fSeed = true; A.measured = 0;
    A.fluxBase = FLUX_SEED; A.fluxR = 1; A.prevFluxR = 1;
    A.bassAvg = 0; A.bassPrev = 0; A.bassBeat = false; A.bassRatio = 0; A.lastBass = A.tAcc;
    A.bandNorm = 0;
    FEAT.onset = false; FEAT.beat = false; FEAT.onsetStrength = 0; FEAT.lastOnsetAt = -9;
  }

  /* ------------------------------------------------------------------ */
  /* وضعیتِ ویژولایزر                                                     */
  /* ------------------------------------------------------------------ */
  const V = {
    canvas: null, gl: null, ok: false, dead: false, raf: 0, running: false, last: 0,
    playing: false, playReported: false, stage: 'calm', stageT: 0, hiT: 0, loT: 0, calmT: 0, cool: 0, tPlay: 0,
    // §AMBIENT لایهٔ فعلی (live|ambient|idle)، دلیلِ خوانا، و ضامنِ مخلوطِ تزئینی↔واقعی
    tier: 'idle', tierWhy: 'IDLE:no_element', tierX: 0,
    // §IDLE حالتِ «صدا هست، منبعِ موسیقی نیست»: رأیِ لایهٔ منبع (audioOnly) + ضامنِ crossfade
    // + ساعتِ پرس‌وجویِ بی‌تایمر (از همان فریم‌ها جلو می‌رود) + دلیلِ خوانا برای diagnostics/HUD.
    idleAudio: false, idleX: 0, idlePoll: 0, idleWhy: 'flag_off', idleE: 0, haloE: 0,
    // §SCENE مدلِ سه‌حالته (idle|source|playing) + کشِ رأیِ منبع + ضامنِ بیداری. vstate فقط از
    // V.playing و srcKind مشتق می‌شود و srcKind حداکثر دو بار در ثانیه تازه می‌شود؛ هیچ‌کدام از
    // این فیلدها صاحبِ مستقلِ «پخش» یا تصمیمِ لایه نیستند — فقط خوانش‌هایِ مشتق‌اند.
    vstate: 'idle', srcKind: 'none', sceneWhy: 'scene:off', awakenX: 0, sceneStill: 0,
    // §SHOW وضعیتِ «کارگردانِ» لایهٔ ambient. هیچ عددی اینجا ادعای موسیقی نیست: فقط زمانِ سپری‌شده
    // درونِ نمایش + seedِ رشته‌ایِ آهنگ. آرایه‌ها پیش‌ساخته‌اند تا در فریم چیزی alloc نشود.
    show: {
      on: false, begins: 0, t: 0, phase: 'overture', seed: 0, seedSrc: '', rng: null,
      env: 0, envTarget: 0, level: 0.8, hueIdx: 0, title: '',
      chroma: new Float32Array(12), pattern: new Float32Array(12), wake: new Float32Array(12),
      order: new Int8Array(12), wOff: new Float32Array(12),
      nextCometAt: 0, nextBloomAt: 0, nextWakeAt: 0, nextFlightAt: 0, nextSurgeAt: 0,
      surgeEndAt: 0, breathEndAt: 0, lastJumpAt: -99, lastFlareAt: -99,
      nComet: 0, nBloom: 0, nWake: 0, nFlight: 0, nFlightNoStars: 0, nSurge: 0, nSurgeNoGate: 0, maxEnvRate: 0
    },
    L: { aurora: 0, galaxy: 0, lum: 0.4 },
    phase: 0, pulse: { t0: -9, amp: 0 }, tick: 0, tickAcc: 0, time: 0,
    tilt: 0, tiltT: 0, spiralPh: 0, spiralPhT: 0, structure: 0, seed3: [0.3, 0.6, 0.1], track: 0,
    bandIn: new Float32Array(12), bandOut: new Float32Array(12), auroraStart: 0, auroraN: 0, noteC: [0.6, 0.7, 1.0],
    cpuMs: 0, haloT: 0, flare: 0, tintC: [1.0, 0.86, 0.60], grace: 0, synE: 0.5,
    q: 1, slowN: 0, fastN: 0, rich: 0.8,
    rs: 1, W: 0, H: 0, vw: 0, vh: 0, cx: 0, cy: 0, scale: 1, incl: 24, N: 0,
    breath: { mix: 0, pitch: 50, zoom: 1, disk: 0, ready: false },
    dive: 0, travel: 0,
    opening: { started: false, elapsed: 0, progress: 0, cycleS: 60, eventS: 12, evLen: 0, openS: 12, phase: 'idle', cam: 0, evAt: -1, nextAt: 0 },
    cosmic: {
      rng: null, nextCometAt: 0, lastPeakAt: -100, peakCandidateUntil: -100, prevEnergy: 0,
      wakeStart: -100, wakeUntil: -100, wakeTier: 0, wakeStrength: 0, glow: 0,
      infallTail: 0.22,
      slotStart: new Float32Array(3).fill(-100), slotDur: new Float32Array(3).fill(14),
      slotAngle: new Float32Array(3), slotRadius: new Float32Array(3), slotStrength: new Float32Array(3),
      infallUniforms: new Float32Array(12),
      reveal: new Float32Array(COSMIC_GROUPS),
      groupDelay: new Float32Array(COSMIC_GROUPS), sessionActive: false, sessionCount: 0, activeElapsed: 0,
      revelationStart: 0, revelationAppear: 8, revelationHold: 26, revelationFade: 12, revelationRest: 60,
      revelationAmount: 0, revelationSeed: 0, revelationEnergy: 0,
      bandAngle: 0.4, bandOffset: 0.25, bandBulge: 0.3, bandWidth: 0.19, bandDirty: true, nextBloomAt: 0
    },
    session: (crypto.getRandomValues(new Uint32Array(1))[0] || 1),
    powder: { on: false, appear: 0, prog: 0, key: '', n: 0, buf: null, vao: null, box: [0, 1] },
    entrance: { pending: false, active: false, elapsed: 0, duration: 1.02, handoff: 0.28, generation: 0, id: null },
    hud: null, hudOn: false, hudT: 0, frames: 0, fps: 0, fpsT: 0, tint: [1, 0.9, 0.7], retimeT: 0
  };
  let G = null;   // منابعِ GL

  /* ---------- مدیرِ کیفیت/منابع ---------- */
  function tierCfg(t) { return QLV[Math.max(0, Math.min(2, t | 0))]; }
  function minTier() { return SND.vq === 'high' ? 1 : 0; }
  function maxTier() { return SND.vq === 'low' ? 0 : 2; }
  function applyTier(t, now) {
    t = Math.max(minTier(), Math.min(maxTier(), t | 0));
    const prev = Q.tier;
    // اگر پلهٔ کیفیت تازه بالا رفته بود و به‌سرعت مجبور به پایین‌آمدن شدیم،
    // تا مدتی دوباره بالا نرویم تا صحنه بین دو کیفیت پمپ نشود.
    if (t < prev && Q.lastUpAt && now - Q.lastUpAt < 20000) { Q.upBlockedUntil = now + 180000; Q.lastUpAt = 0; }
    if (t > prev) Q.lastUpAt = now;
    const cfg = tierCfg(t);
    Q.tier = t;
    Q.budget = cfg.budget; Q.auroraEvery = cfg.aurora; Q.band = cfg.band; Q.calm = cfg.calm;
    if (V.q > cfg.q) V.q = cfg.q;              // پایین‌آمدن فوری؛ بالا رفتن تدریجی
    Q.scaleDirty = true;
    Q.tierCooldown = now + 2500;
    Q.slow = 0; Q.fast = 0;
  }
  function syncQualityMode() {
    const now = performance.now();
    Q.upBlockedUntil = 0; Q.lastUpAt = 0;      // تغییرِ دستیِ تنظیم، قفلِ آزمونِ کیفیت را باز می‌کند
    if (SND.vq === 'low') applyTier(0, now);
    else if (SND.vq === 'high') { applyTier(2, now); V.q = 1; }
    else { Q.tier = Q.autoTier; applyTier(Q.tier, now); }
  }
  function pickScale() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    let rs = dpr;
    while (V.vw * V.vh * rs * rs > Q.budget && rs > 0.35) rs -= 0.05;
    return Math.max(0.35, rs);
  }
  function applyRenderScale(now) {
    if (!V.ok || !Q.scaleDirty || now < Q.scaleCooldown) return;
    Q.scaleDirty = false;
    const rs = pickScale();
    if (Math.abs(rs - V.rs) < 0.035) { Q.scaleCooldown = now + 1200; return; }
    sizeTarget(rs);
    Q.scaleCooldown = now + 3000;
    Q.grace = Math.max(Q.grace, now + 1500);
    V.grace = Math.max(V.grace, now + 1500);
  }
  function updateQuality(now) {
    if (!V.playing || reduced() || document.hidden || now < Q.grace || now < V.grace) return;
    Q.fpsEma = Q.fpsEma > 0 ? Q.fpsEma + (V.fps - Q.fpsEma) * 0.35 : V.fps;
    Q.msEma = Q.msEma > 0 ? Q.msEma + (V.cpuMs - Q.msEma) * 0.35 : V.cpuMs;
    const active = V.stage === 'galaxy' || V.dive > 0.05 || V.powder.on || V.entrance.active;
    if (!active) { Q.slow = 0; Q.fast = 0; return; }
    const tgt = CFG.galaxyFps;
    if (Q.fpsEma < tgt * 0.88 || Q.msEma > 10) {
      Q.slow++; Q.fast = 0;
      const floor = SND.vq === 'high' ? 0.60 : 0.40;
      if (V.q > floor) V.q = Math.max(floor, V.q - 0.045);
    } else if (Q.fpsEma > tgt * 0.97 && Q.msEma < 6) {
      Q.fast++; Q.slow = 0;
      const target = QLV[Q.tier].q;
      if (V.q < target) V.q = Math.min(target, V.q + 0.030);
    } else { Q.slow = 0; Q.fast = 0; }
    if (now < Q.tierCooldown) return;
    if (Q.slow >= 2 && Q.tier > minTier()) applyTier(Q.tier - 1, now);
    else if (Q.fast >= 6 && Q.tier < maxTier() && now > Q.upBlockedUntil) applyTier(Q.tier + 1, now);
  }

  /* ---------- GL ---------- */
  const VS_TRI = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

  const FS_AURORA = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uLevel; uniform vec3 uSeed; uniform vec3 uTint;
uniform vec2 uHole; uniform float uAsp, uBend; uniform vec4 uInfall[3]; uniform float uInfallTail, uHorizon;
uniform vec4 uBand; uniform vec4 uBandP; uniform float uBandLow; uniform vec4 uBloom[3];
out vec4 o;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++){ s += a * vn(p); p = p * 2.02 + 7.1; a *= 0.5; } return s; }
float fbm5(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
void main(){
  vec2 uv0 = gl_FragCoord.xy / uRes;
  // Keep a restrained lensing distortion, but leave visible ring structure to the 3D particles.
  vec2 q = (uv0 - uHole) * vec2(uAsp, 1.0);
  float r = length(q);
  float pull = uBend * 0.016 / (r * r + 0.020);
  float sw = uBend * 0.55 / (1.0 + 9.0 * r * r);
  float cs = cos(sw), sn = sin(sw);
  vec2 qd = q - (q / max(r, 0.001)) * pull;
  qd = vec2(cs * qd.x - sn * qd.y, sn * qd.x + cs * qd.y);
  float t = uTime * 0.012;
  float n0 = fbm(qd * 10.0 + uSeed.xy * 13.0 + vec2(t * 0.36, -t * 0.24));
  float n1 = fbm(qd * 5.0 + uSeed.yz * 7.0 - vec2(t * 0.15, t * 0.11));
  float cloud = exp(-r * 2.4) * smoothstep(0.045, 0.17, r) * smoothstep(0.24, 0.54, n0 * 0.65 + n1 * 0.35);
  cloud *= uLevel * uBend * 0.055;
  vec2 metric = vec2(uAsp, 1.0);
  float spiralLight = 0.0;
  float spiralR = length(q);
  float spiralAngle = atan(q.y, q.x);
  float horizonRadius = max(uHorizon, 0.001);
  for (int i = 0; i < 3; i++) {
    vec4 infall = uInfall[i];
    if (infall.x >= 0.0 && infall.w > 0.001) {
      float pathProgress = clamp((infall.z - spiralR) / max(infall.z - horizonRadius, 0.001), 0.0, 1.0);
      float pathAngle = infall.y + 6.28318 * 1.12 * pathProgress + 0.42 * sin(pathProgress * 3.14159);
      float angleDelta = abs(mod(spiralAngle - pathAngle + 3.14159, 6.28318) - 3.14159);
      float crossTrack = angleDelta * max(spiralR, 0.01);
      float width = max(0.0018 + 0.0012 * pathProgress, 1.1 / uRes.y);   // هرگز باریک‌تر از ~۱ پیکسلِ بافتِ ¼-رزولوشن (وگرنه کم‌رنگ و ناپایدار می‌شد)
      float tailAge = infall.x - pathProgress;
      float tailLength = uInfallTail * (1.0 - 0.58 * infall.x);
      float tail = smoothstep(0.0, 0.035, tailAge) * (1.0 - smoothstep(tailLength - 0.035, tailLength, tailAge));
      float headWidth = mix(0.018, 0.030, smoothstep(0.65, 0.92, infall.x));
      float head = exp(-pow(tailAge / headWidth, 2.0));
      float track = exp(-pow(crossTrack / width, 2.0)) * step(-0.03, tailAge);
      float approachFade = 1.0 - smoothstep(0.76, 1.0, infall.x);
      spiralLight += (0.20 * tail + 0.66 * head) * track * smoothstep(0.0, 0.10, infall.x) * approachFade * infall.w;
    }
  }
  vec3 infallColor = mix(vec3(0.76, 0.86, 1.0), uTint, 0.10);
  vec3 distantGalaxy = vec3(0.0);
  float bandDens = 0.0;
  if (uBandP.x > 0.001) {
    // راه شیری: نواری مورب با برآمدگی گرم، شیارِ تاریکِ غبار و ابرهای ستاره‌ای (نه مارپیچِ روبه‌رو)
    vec2 rel = uv0 * metric - 0.5 * metric;
    vec2 dir = vec2(cos(uBand.x), sin(uBand.x));
    vec2 nrm = vec2(-dir.y, dir.x);
    float s = dot(rel, dir);
    float d0 = dot(rel, nrm) - uBand.y;
    float w = uBand.w;
    float sd = uBandP.y * 41.0;
    float tb = uTime * 0.0016;
    float d = d0 + (fbm(vec2(s * 1.6 + sd, 3.7)) - 0.5) * 0.55 * w + (fbm5(vec2(s * 4.0 + sd, d0 * 3.0 + 5.0)) - 0.5) * 0.30 * w;
    float core = exp(-pow(d / w, 2.0));
    float halo = exp(-abs(d) / (w * 2.4)) * 0.22;
    float bulge = exp(-pow((s - uBand.z) / 0.34, 2.0));
    float bulgeW = exp(-pow(d / (w * 1.25), 2.0));
    float clouds = fbm5(vec2(s * 5.0 + tb, d * 10.0) + sd);
    float fine = fbm5(vec2(s * 17.0, d * 34.0) + sd * 1.7);
    float dens = (core * (0.50 + 0.95 * clouds) + halo * (0.60 + 0.80 * clouds)) * (0.62 + 0.55 * fine);
    dens += bulge * bulgeW * 0.85 * (0.70 + 0.50 * clouds);
    // شیارِ بزرگِ غبار (Great Rift): باریک، کمی خارج از مرکز، با لکه‌های غبارِ پراکنده
    float laneC = (fbm(vec2(s * 2.3, 1.9) + sd * 0.3) - 0.5) * 0.70 * w;
    float lane = exp(-pow((d - laneC - 0.10 * w) / (0.20 * w), 2.0));
    float dpatch = smoothstep(0.38, 0.70, fbm5(vec2(s * 6.0 + tb, d * 14.0) + sd * 2.3));
    float dust = clamp(lane * (0.55 + 0.75 * dpatch) + 0.40 * dpatch * core, 0.0, 1.0);
    dens *= 1.0 - 0.80 * dust * (1.0 - 0.35 * bulge);
    // کنتراستِ موضعی هم‌گام با اوج‌ها: ابرها روشن‌تر، غبار عمیق‌تر (تنها در بخشی از افق)
    float loc = 0.0;
    for (int bi = 0; bi < 3; bi++) loc += uBloom[bi].z * exp(-pow((s - uBloom[bi].x) / max(uBloom[bi].y, 0.05), 2.0));
    loc = clamp(loc, 0.0, 1.4);
    dens *= (1.0 + 1.5 * loc * smoothstep(0.25, 0.85, clouds)) * (1.0 - 0.45 * loc * dust);
    bandDens = clamp(dens * 0.6, 0.0, 1.0);
    // رنگ: مرکزِ کهربایی، حاشیهٔ آبی-سفید؛ موسیقیِ روشن‌تر کمی سردتر، گرم و کم‌فرکانس گرم‌تر
    float warmMix = clamp(0.10 + 0.85 * bulge * bulgeW + 0.30 * (1.0 - uBandP.w), 0.0, 1.0);
    vec3 col = mix(vec3(0.50, 0.66, 1.0), vec3(1.0, 0.76, 0.50), warmMix);
    col = mix(col, uTint, 0.08);
    float expo = uBandP.x * (0.86 + 0.26 * uBandP.z) * (1.0 + 0.22 * uBandLow * bulge) * (1.0 + 0.35 * loc);
    float dimNear = 1.0 - 0.50 * exp(-pow(r / 0.30, 2.0));          // کنتراستِ سیاه‌چالهٔ مرکزی حفظ می‌شود
    vec3 lum = col * dens * expo * 0.48 * dimNear;
    distantGalaxy = lum / (1.0 + 0.9 * lum);
  }
  vec3 ambient = mix(vec3(0.10, 0.62, 0.94), uTint, 0.14) * cloud + infallColor * spiralLight + distantGalaxy;
  ambient *= smoothstep(0.05, 0.22, uv0.y) * (1.0 - smoothstep(0.78, 0.95, uv0.y));   // لبهٔ بالا و پایینِ تصویر سیاه
  o = vec4(pow(max(ambient, 0.0), vec3(0.92)), bandDens);   // آلفا = چگالیِ نوار (فقط برای ستاره‌های نوار؛ blit آن را صفر می‌کند)
}`;

  /* ستاره‌هایی که از بازوها جدا می‌شوند: مارپیچِ طلاییِ کم‌عمر. همه‌چیز روی GPU از زمان محاسبه می‌شود (بدون به‌روزرسانیِ بافر) */
  const VS_EJECTA = `#version 300 es
precision highp float;
in vec4 aA; in vec4 aB;
uniform vec2 uView; uniform vec2 uCenter;
uniform float uScale, uSin, uTilt, uTime, uRate, uPx, uPhase, uTh0, uK, uArms;
out float vA; out float vW;
float h1(float x){ return fract(sin(x * 127.1 + 311.7) * 43758.5453); }
void main(){
  float t = uTime - aA.w;
  float cyc = floor(t / aA.z);
  float age = t - cyc * aA.z;
  float life = aA.z * 0.72;
  float hv = h1(cyc * 7.31 + aB.x * 91.7);
  float gate = smoothstep(hv, hv + 0.14, uRate);
  if (cyc < 0.0 || age > life || gate < 0.01) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; vW = 0.0; gl_PointSize = 1.0; return; }
  float u = age / life;
  float arm = floor(h1(cyc * 3.17 + aB.x * 17.0) * uArms);
  float r = aA.x * (0.94 + 0.12 * h1(cyc + aB.x * 5.0)) + aB.y * pow(u, 1.25);
  float scatter = (h1(cyc * 1.91 + aB.x * 29.0) - 0.5) * 0.30;
  float th = uTh0 + arm * 6.2831853 / uArms + uK * log(r / 0.19) + scatter;
  th -= uPhase * (0.10 * pow(r + 0.05, -1.5) + 1.53);
  float side = sin(th);
  vec2 p = vec2(r * cos(th), r * side * uSin);
  float c = cos(uTilt), s = sin(uTilt);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  vec2 px = uCenter + p * uScale;
  gl_Position = vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);
  float env = pow(sin(3.14159265 * u), 1.3);
  vA = env * gate * 0.85; vW = u;
  gl_PointSize = clamp(aB.z * (0.8 + 0.5 * env) * uPx, 1.0, 7.0);
}`;
  const FS_EJECTA = `#version 300 es
precision mediump float;
in float vA; in float vW;
out vec4 o;
void main(){
  vec2 d = gl_PointCoord - 0.5; float q = dot(d, d) * 4.0;
  if (q > 1.0) discard;
  float a = exp(-q * 3.0) + 0.25 * exp(-q * 1.1);
  vec3 col = mix(vec3(1.0, 0.78, 0.40), vec3(1.0, 0.93, 0.78), vW);
  o = vec4(col * a * vA, 0.0);
}`;
  const EJ = { M: 180, data: null };
  function buildEjecta() {
    const rnd = mulberry32((V.session ^ 0xE1EC7A) >>> 0), d = new Float32Array(EJ.M * 8);
    for (let i = 0; i < EJ.M; i++) {
      const o = i * 8, per = 5.5 + rnd() * 4.5;
      d[o] = 0.20 + 0.52 * Math.pow(rnd(), 1.35); d[o + 1] = rnd(); d[o + 2] = per; d[o + 3] = rnd() * per;
      d[o + 4] = rnd(); d[o + 5] = 0.16 + 0.22 * rnd(); d[o + 6] = 1.4 + 1.8 * rnd(); d[o + 7] = 0;
    }
    return d;
  }
  V.ejRate = 0; V.ejBurst = 0;

  /* دنباله‌دارها: روبانِ نرم در فضای صفحه (نه رسمِ پیکسل‌به‌پیکسل در بافتِ ¼-رزولوشن) + سرِ درخشان/ستاره‌ای */
  const VS_COMET = `#version 300 es
precision highp float;
in vec2 aPos; in vec2 aUV; in vec2 aKA; in vec3 aCol;
uniform vec2 uView;
out vec2 vUV; out float vA; out float vK; out vec3 vC;
void main(){
  gl_Position = vec4(aPos.x / uView.x * 2.0 - 1.0, 1.0 - aPos.y / uView.y * 2.0, 0.0, 1.0);
  vUV = aUV; vA = aKA.y; vK = aKA.x; vC = aCol;
}`;
  const FS_COMET = `#version 300 es
precision mediump float;
in vec2 vUV; in float vA; in float vK; in vec3 vC;
out vec4 o;
void main(){
  float r2 = dot(vUV, vUV);
  float I;
  if (vK < 0.5) { I = exp(-vUV.x * vUV.x * 4.2); }
  else if (vK < 1.5) { I = exp(-r2 * 5.0) + 0.10 * exp(-r2 * 1.4); }
  else if (vK > 2.5) { I = 0.80 * exp(-r2 * 3.0) + 0.50 * exp(-r2 * 14.0); }   // هات‌اسپاتِ مرکزی
  else {
    float ax = abs(vUV.x), ay = abs(vUV.y);
    float core = exp(-r2 * 10.0);
    float spikes = exp(-ax * 20.0) * exp(-ay * 2.4) + exp(-ay * 20.0) * exp(-ax * 2.4);
    I = core + 0.45 * spikes + 0.08 * exp(-r2 * 1.8);
  }
  float edge = (vK < 0.5) ? 1.0 : (1.0 - smoothstep(0.72, 1.0, max(abs(vUV.x), abs(vUV.y))));
  vec3 col = mix(vC, vec3(1.0), clamp(0.35 * I * I, 0.0, 0.4));
  o = vec4(col * I * edge * vA, 0.0);
}`;

  const VS_COSMIC_DOTS = `#version 300 es
precision highp float;
in vec4 aCosmic; // normalized x/y, seed, cluster index (-1 = quiet baseline, -2 = Milky Way band star)
uniform vec2 uView; uniform float uPx, uTime, uLevel, uGlow, uAspect; uniform float uReveal[24]; uniform vec3 uPrimary;
uniform sampler2D uBandTex; uniform float uBandAmt, uBandHigh;
out vec3 vColor; out float vAlpha;
void main(){
  float group = floor(aCosmic.w + 0.5);
  bool bandStar = group < -1.5;
  float wake = 0.10;
  if (group >= -0.5) wake = uReveal[int(clamp(group, 0.0, 23.0))];
  float phase = aCosmic.z * 91.7;
  float twinkle = 0.94 + 0.06 * sin(uTime * 0.17 + phase);
  float tint = step(0.82, fract(aCosmic.z * 13.17));
  vColor = mix(vec3(0.74, 0.84, 1.0), vec3(1.0, 0.88, 0.70), tint * 0.22);
  vAlpha = wake * uLevel * (group < -0.5 ? 0.10 + 0.10 * uGlow : 0.40) * twinkle;
  float size = group < -0.5 ? 1.05 : 1.15 + fract(aCosmic.z * 7.31) * 1.25;
  vec2 p = aCosmic.xy * uView;
  vec2 screenMetric = vec2(aCosmic.x * uAspect, 1.0 - aCosmic.y);
  vec2 primaryMetric = vec2(uPrimary.x * uAspect, uPrimary.y);
  float pd = distance(screenMetric, primaryMetric) / max(uPrimary.z, 0.001);
  if (bandStar) {
    // ستاره‌های نوار: چگالی/شیارِ غبار از آلفای بافتِ شفق خوانده می‌شود، پس همیشه با ابرهای نوار هم‌خوان‌اند
    float mag = fract(aCosmic.z * 7.31);
    float dn = textureLod(uBandTex, vec2(aCosmic.x, 1.0 - aCosmic.y), 0.0).a;
    float tw = 0.82 + 0.18 * sin(uTime * (0.25 + mag * 0.9) + phase);
    float spark = 1.0 + uBandHigh * 0.9 * step(0.86, fract(aCosmic.z * 17.3));
    float warm = step(0.7, fract(aCosmic.z * 5.13));
    vColor = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.84, 0.62), warm * 0.55);
    vAlpha = uBandAmt * smoothstep(0.05, 0.34, dn) * (0.14 + 0.86 * mag * mag) * tw * spark
           * smoothstep(0.10, 0.45, pd) * (0.55 + 0.45 * smoothstep(0.45, 1.0, pd));
    size = 1.0 + 1.7 * mag * mag * mag;
  } else if (pd < 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vAlpha = 0.0; gl_PointSize = 1.0; return; }
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
  float ym = 1.0 - aCosmic.y;
  vAlpha *= smoothstep(0.05, 0.22, ym) * (1.0 - smoothstep(0.78, 0.95, ym));   // ستاره‌ها هم در لبهٔ بالا/پایین محو می‌شوند
  gl_PointSize = clamp(size * uPx, 1.0, 3.0);
}`;

  const FS_COSMIC_DOTS = `#version 300 es
precision mediump float;
in vec3 vColor; in float vAlpha; out vec4 o;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d) * 4.0;
  float core = exp(-r * 5.0);
  float edge = 1.0 - smoothstep(0.55, 1.0, r);
  float glow = core * edge;
  o = vec4(vColor * vAlpha * glow, 0.0);
}`;

  const FS_BLIT = `#version 300 es
precision mediump float;
uniform sampler2D uTex; uniform vec2 uRes; uniform float uMix;
out vec4 o;
void main(){ vec2 uv = gl_FragCoord.xy / uRes; o = vec4(texture(uTex, uv).rgb * uMix, 0.0); }`;

  const VS_DOTS = `#version 300 es
precision highp float;
in vec2 aPolar;   // r, theta0
in vec4 aMisc;    // seed, size, band (0..11 = pitch class, 12 = inner dust, 13 = outer dust), tier
in float aU;      // position inside its band, 0..1
uniform vec2 uView; uniform vec2 uCenter; uniform float uScale, uSin, uTilt, uPx, uHalf, uDiskBreath, uHoleR;
uniform float uPhase, uReveal, uLum, uTime, uPulseR, uPulseA, uDim, uMid, uHigh, uStructure;
uniform float uDive, uTravel, uCull;   // شیرجه: uDive ۰..۱، مسافتِ حرکت، و خاموش‌کردنِ برشِ نیمهٔ دیسک
uniform float uChroma[12]; uniform vec3 uPal[12]; uniform float uTint[12];   // uTint: «لمسِ رنگ» هر لایه (۰ = سفید، ۱ = رنگِ کاملِ نت)
uniform sampler2D uAur; uniform float uAurMix;
out vec4 vCol;
out vec3 vDiskView;
out float vPointDiameter;
out float vHalo;
void main(){
  float seed = aMisc.x, band = aMisc.z;
  bool ring = band < 11.5;
  float baseR = aPolar.x;
  float r = baseR * (ring ? 1.0 + uDiskBreath * (0.78 + 0.22 * aU) : 1.0);
  // چرخشِ الگو: یک دورِ صلب (همهٔ لایه‌ها با هم) + برشِ *کران‌دار*. شکلِ قبلی omega را در uPhase
  // بی‌وقفه جمع می‌کرد، پس لایهٔ درونی در چند دقیقهٔ پخش چند رادیان جلو می‌افتاد و بازوی مارپیچ
  // تا خورده و پخش می‌شد. اینجا تفاوتِ سرعت فقط تا WIND_MAX بالا می‌آید و همان‌جا می‌ماند:
  // هر تابعِ هموارِ شعاع، دالانِ بازو را می‌پیچد ولی گسست یا محو نمی‌سازد.
  const float OMEGA_PATTERN = 1.53;
  const float WIND_MAX = 0.55;
  const float WIND_RAMP = 1.2;
  const float WIND_R0P = 0.24;
  float rel = pow(WIND_R0P / (baseR + 0.05), 1.5);
  float wind = uPhase >= 0.0 ? WIND_MAX * min(1.0, uPhase / WIND_RAMP) * rel : 0.0;
  // موجِ چگالی که با uPhase به *داخل* حرکت می‌کند (جریانِ پیوستهٔ گرانشی). چون از جمعِ زمانیِ
  // uPhase می‌آید، سرعتش با انرژیِ موسیقی بالا می‌رود ولی در آرامشِ موسیقی هم صفر نمی‌شود.
  const float WAVE_K = 60.0;
  float armWave = sin(aU * 6.28318 * 2.0 + uPhase * WAVE_K + uStructure * 2.0 + seed * 0.9);
  float th = aPolar.y - uPhase * OMEGA_PATTERN - wind + (ring ?     // پادساعت‌گرد روی صفحه: زاویه با زمان کم می‌شود
   armWave * (0.026 * uMid + 0.018 * uStructure) : 0.0);
  float side = sin(th);
  float warp = clamp(uDive, 0.0, 1.0);
  // غبارِ لبه پیوسته به دیسک فرو می‌ریزد: نرخِ حرکت از جمعِ زمانیِ uPhase می‌آید، پس حتی در
  // موسیقیِ آرام جریان دارد و با انرژی بلندتر می‌شود؛ هر ذره هم فازِ خودش (baseR*7) و هم
  // سرعتِ خودش (از seed) دارد، پس نه صفوفِ منظم می‌سازد و نه همه با هم به یک شعاع می‌رسند.
  // در warp=۱ خاموش می‌شود، آن‌جا جریانِ خودِ تونل جایش را می‌گیرد.
  const float INFLOW_SPAN = 0.46;
  const float INFLOW_RATE = 4.0;
  const float INFLOW_VAR = 0.78;   // دامنهٔ پراکندگیِ سرعتِ فروریزش حولِ INFLOW_RATE (×۰٫۶۲ تا ×۱٫۴۰)
  bool dustFall = band > 12.5 && band < 13.5;
  float inflowP = dustFall ? fract(baseR * 7.0 + uPhase * INFLOW_RATE * (1.0 - INFLOW_VAR / 2.0 + INFLOW_VAR * seed)) : 0.0;
  if (dustFall) r -= INFLOW_SPAN * inflowP * (1.0 - warp);
  // پوششِ مسیر: دو سرِ فروریزش محو و میانه روشن → بازگشتِ دورِ هیچ ذره‌ای دیده نمی‌شود و
  // هیچ ذرهٔ روشنی داخلِ لبهٔ دیسک (چه‌رسد به سیلوئتِ کرهٔ سیاه) نمی‌نشیند.
  float inflowEnv = dustFall ? mix(smoothstep(0.0, 0.14, inflowP) * (1.0 - smoothstep(0.66, 0.96, inflowP)), 1.0, warp) : 1.0;
  // نیمهٔ دورِ حلقه‌ها پشتِ کره، نیمهٔ نزدیک جلوی آن رسم می‌شود (دو پاس)
  // §B برشِ نیمه‌ها حالا وزن دارد تا آستانه پرش نداشته باشد:
  //   uCull = 1        همان برشِ سختِ همیشگی (وزنِ پاسِ درست ۱، پاسِ دیگر دور ریخته می‌شود)
  //   uCull در (0,1)  پنجرهٔ نرم: هر دو پاس همه را می‌بینند ولی با وزنِ مکمل (w و ۱-w)
  //   uCull < 0        تک‌پاسِ شیرجهٔ عمیق: بدونِ برش و با وزنِ ۱ (دقیقاً رفتارِ امروز)
  float softE = max(1.0 - uCull, 0.0001);
  float nearW = smoothstep(-softE, softE, side);
  float halfKeep = uCull < 0.0 ? 1.0 : (uHalf < 0.5 ? 1.0 - nearW : nearW);
  if (band > 13.5 || halfKeep <= 0.0008) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vCol = vec4(0.0); vDiskView = vec3(0.0); vPointDiameter = 0.0; gl_PointSize = 1.0; return; }
  vec2 p = vec2(r * cos(th), r * side * uSin);
  float c = cos(uTilt), s = sin(uTilt);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  // Orthographic view of the inclined disk: screen Y is compressed by sin(i),
  // while the omitted camera-depth coordinate is the complementary cos(i).
  float diskDepth = r * side * sqrt(max(0.0, 1.0 - uSin * uSin));
  // حلقه‌های بی‌نهایت: شعاعِ هر ذره در بازهٔ [R_MIN,R_MAX] می‌چرخد و با uTravel در طولِ
  // تونل جلو می‌رود؛ حلقه‌ای که از لبه بیرون می‌رود محو می‌شود و همان لحظه حلقهٔ تازه‌ای
  // نزدیکِ افق می‌زاید. همهٔ تغییراتِ زیر با warp (مقدارِ شیرجه) وزن می‌شوند، پس در
  // warp=۰ هندسه دقیقاً همان دیسکِ کهکشان است و گذار رفت و برگشت بدونِ پرش می‌ماند.
  const float R_MIN = 0.13, R_MAX = 1.42, SPAN = R_MAX - R_MIN;
  const float ZOOM = 2.3903;              // ln(R_MAX/R_MIN) : رشدِ هندسیِ شعاع با عمق
  const float PHI_INV2 = 0.3819660113;    // ۱/φ² : پخشِ طلاییِ گروه‌ها در طولِ تونل
  const float QTR = 1.5707963, LN_PHI = 0.4812118;   // π/۲ و ln(φ) → مارپیچِ لگاریتمیِ طلایی
  const float SPIRAL_DAMP = 0.34;         // فقط بخشی از پیچشِ طلایی کامل باز می‌ماند تا بازوها وارفته نشوند
  // هر گروه (۱۲ نوار + دو غبار) با آفستِ طلایی در طولِ تونل پخش می‌شود تا همیشه
  // حلقه‌هایی در مرکز، میانه و لبه‌ها حاضر باشند؛ نه اینکه همه با هم به لبه برسند.
  float bandOff = warp * fract(band * PHI_INV2) * SPAN;
  float rLoop = R_MIN + mod(r - R_MIN + uTravel + bandOff, SPAN);
  float depth = clamp((rLoop - R_MIN) / SPAN, 0.0, 1.0);
  float loopFade = smoothstep(R_MIN, R_MIN + 0.10, rLoop) * (1.0 - smoothstep(R_MAX - 0.24, R_MAX, rLoop));
  // پرسپکتیو: شعاعِ رسمِ حلقه با عمق *هندسی* بزرگ می‌شود (r = R_MIN·e^(ZOOM·depth))، نه خطی؛
  // همان چیزی که دوربینِ باسرعتِ ثابتِ درونِ لوله می‌دهد: فشرده‌شدنِ حلقه‌ها near افق و
  // گشاده‌شدن near خروج. در warp=0 هیچ‌چیز جابه‌جا نمی‌شود، پس گذار از کهکشان پرش ندارد.
  float rPersp = R_MIN * exp(ZOOM * depth);
  // مارپیچِ طلایی (لگاریتمی): زاویه با logِ شعاع می‌پیچد → لایه‌ها هیچ‌وقت حلقهٔ هم‌مرکز نیستند
  float thT = th + warp * SPIRAL_DAMP * QTR * ZOOM / LN_PHI * depth;
  // لبهٔ تونل دایره نیست: چهار هارمونیکِ فیبوناچی (۳،۵،۸،۱۳) با فازهای ثابت و درفتِ
  // آهستهٔ ناهم‌دوره، شعاع را تابعِ زاویه می‌کنند → در هیچ فریمی مرزِ دایره‌ایِ هموار نمی‌ماند.
  float rim = sin(thT * 3.0 + uTime * 0.091) + 0.62 * sin(thT * 5.0 - uTime * 0.053 + 1.7)
            + 0.38 * sin(thT * 8.0 + uTime * 0.031 + 2.9) + 0.24 * sin(thT * 13.0 - uTime * 0.019 + 4.1);
  // اعوجاجِ لبه در دهانهٔ تونل کامل است و تا افق کم می‌شود، اما هرگز صفر نمی‌شود (مرزِ
  // دایره‌ایِ هموار در هیچ فریمی باقی نمی‌ماند). آستانهٔ پایین فقط به‌اندازهٔ ~۴٪ِ HOLE_R
  // جابه‌جا می‌کند، پس حلقه‌های چسبیده به تکینگی مرکزِ کرهٔ سیاه را نمی‌لغزند.
  float rimBite = 0.18 + 0.82 * smoothstep(0.10, 0.55, depth);
  // دامنهٔ پایه هرگز صفر نمی‌شود؛ میدرنج کمی بازش می‌کند (ساختار، نه نویز). ۰٫۴۴۶ = ۱/سقفِ مجموعِ هارمونیک‌ها
  float rDraw = rPersp * (1.0 + warp * rimBite * (0.038 + 0.030 * clamp(uStructure, 0.0, 1.0)) * rim * 0.446);
  vec2 pt = vec2(cos(thT), sin(thT)) * rDraw;
  pt = vec2(c * pt.x - s * pt.y, s * pt.x + c * pt.y);
  // کجیِ محور تونل به حلقه‌های *نزدیک* داده می‌شود، نه دوردست: انتهای تونل دقیقاً روی
  // تکینگی می‌ماند (مرکزیتِ کرهٔ سیاه حفظ می‌شود، occlusion نمی‌شکند) و میلِ استوانه
  // در دهانه خوانده می‌شود. سقفِ جابه‌جایی ۰٫۰۳ ≈ ۲۷٪ِ HOLE_R=۰٫۱۱ است.
  pt += vec2(-s, c) * (uSin * 0.030 * smoothstep(0.25, 1.0, depth) * warp);
  p = mix(p, pt, warp);
  vDiskView = vec3(p, mix(diskDepth, depth, warp));
  int ib = int(clamp(band, 0.0, 11.0) + 0.5);
  float e = ring ? uChroma[ib] : 0.0;
  // رنگِ پیش‌فرض: خاکستری‌های روشن و تیره (هر ذره درخششِ خودش را دارد)؛ نزدیکِ افق کمی گرم، دورتر سردتر؛ پرنورها هاله دارند
  float gS = 0.40 + 0.26 * pow(seed, 2.2);                    // مرحلهٔ اول: خاکستریِ کم‌کنتراست و یکنواخت‌تر (دامنهٔ ۰٫۴۰…۰٫۶۶)
  float warmK = 1.0 - smoothstep(0.16, 0.62, baseR);
  vec3 neutral = gS * mix(vec3(0.84, 0.89, 1.0), vec3(1.0, 0.90, 0.76), 0.62 * warmK);
  // مرحلهٔ دوم: لایه‌ای که لمسِ رنگ می‌گیرد (tA) ارزشِ بصریِ بیشتری دارد: روشن‌تر، کمی درشت‌تر و با هالهٔ پررنگ‌تر؛ بقیه کم‌اهمیت می‌مانند
  int hueI = int(clamp(aMisc.w, 0.0, 6.0) + 0.5);
  float tA = ring ? (ib < 7 ? clamp(uTint[ib], 0.0, 1.0) : 0.0) : (band < 12.5 ? clamp(uTint[hueI], 0.0, 1.0) : 0.0);
  float halo = smoothstep(0.76, 0.98, seed) * (0.45 + 0.90 * tA);
  vHalo = halo;
  float sz = aMisc.y * 1.30 * (1.0 + 1.10 * e * uLum) * mix(0.92 + 0.22 * side, 1.0, warp) * (1.0 + 0.60 * halo) * (1.0 + 0.30 * tA);
  sz *= mix(1.0, 0.65 + 1.55 * depth, warp);   // هرچه به لبهٔ خروج نزدیک‌تر، درشت‌تر
  vec2 px = uCenter + p * uScale;
  gl_Position = vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);

  float edge = smoothstep(0.0, 0.14, aU) * (1.0 - smoothstep(0.86, 1.0, aU));     // لبه‌های نرمِ هر نوار
  float shimmer = 0.88 + 0.12 * sin(uTime * (0.7 + 1.8 * seed) + seed * 47.0);
  float dop = 1.0 + 0.30 * (-cos(th));
  // درِ آشکارسازیِ دیسک فقط در حالتِ کهکشان کار می‌کند؛ در تونل، ذره‌ای که دوردستِ دیسک
  // نشسته بود هم باید دیده شود (وگرنه جمعیتِ لبه درست جایی که لازم است خاموش می‌ماند).
  float vis = 1.0 - (1.0 - warp) * smoothstep(uReveal - 0.28, uReveal, r);
  float pulse = uPulseA * exp(-pow((r - uPulseR) / 0.05, 2.0));
  float lum; vec3 col;
  if (ring) {
    // هفت رینگِ نخست طیفِ ثابت دارند؛ رینگ‌های بعدی سفیدند.
    lum = (0.88 + 1.55 * e * (0.40 + 0.60 * uLum)) * (0.52 + 0.48 * edge);
    col = ib < 7 ? mix(neutral, uPal[ib], clamp(uTint[ib], 0.0, 1.0)) : neutral;
  } else if (band < 12.5) {
    // رنگِ ذراتِ نزدیکِ افق از هندسهٔ ساخته‌شده می‌آید، نه از محاسبهٔ فریمی.
    int hue = int(clamp(aMisc.w, 0.0, 6.0) + 0.5);
    lum = 0.85; col = mix(neutral, uPal[hue], clamp(uTint[hue], 0.0, 1.0));
  } else if (band < 13.5) {
    // غبارِ لبه: روشنایی از seed (تنوعِ درخشش) و از پوششِ مسیرِ فروریزش؛ هرگز به درونِ
    // دیسک و سایهٔ کرهٔ سیاه نمی‌رسد، پس مرکزیت و خواناییِ سیاه‌چاله حفظ می‌شود.
    lum = 0.46 * (0.55 + 0.75 * seed) * inflowEnv;
    col = neutral * 0.92;
  } else {
    lum = 0.46 * (1.0 - smoothstep(0.80, 1.0, r)); col = neutral * 0.92;
  }
  lum *= mix(0.78, 1.9, tA);                                  // بی‌رنگ ۰٫۷۸×، رنگی تا ۱٫۹× ⇒ رنگ‌ها «ارزش» پیدا می‌کنند
  // نورِ مشترک: ذره‌ها از شفقِ پشتِ خودشان نور و رنگ می‌گیرند (هویتِ یکپارچه)
  vec3 ac = textureLod(uAur, vec2(px.x / uView.x, 1.0 - px.y / uView.y), 0.0).rgb;
  float al = dot(ac, vec3(0.30, 0.55, 0.15));
  if (!ring) {
    col = mix(col, normalize(ac + 0.02) * 0.95, clamp(al * 2.0, 0.0, 0.32) * uAurMix);
    lum *= 1.0 + 1.5 * al * uAurMix;
  }
  float highGlint = uHigh * smoothstep(0.91, 0.995, seed) * (0.5 + 0.5 * sin(uTime * (1.8 + seed * 1.3) + seed * 47.0));
  float depthGlow = mix(1.0, 0.88 + 1.20 * depth, warp);          // ستاره‌های نزدیک به خروج، روشن‌تر و درشت‌تر
  float tunnelDop = mix(dop, 1.0, warp);
  float fade = mix(1.0, loopFade, warp);
  float spark = smoothstep(0.55, 1.0, depth) * warp;             // فورانِ سفید-گرم در لبهٔ خروج
  col = mix(col, vec3(1.0, 0.95, 0.85), 0.50 * spark);
  lum = (lum * shimmer * (1.0 + (ring ? 0.10 * uMid * armWave : 0.0) + 0.32 * highGlint) + pulse * 0.9) * tunnelDop * vis * uDim * depthGlow * fade;
  vCol = vec4(col * lum * halfKeep, 0.0);
  gl_PointSize = clamp(sz * uPx, 1.0, mix(10.0, 14.0, warp));
  vPointDiameter = gl_PointSize / max(uPx * uScale, 0.001);
}`;

  const FS_DOTS = `#version 300 es
precision mediump float;
in vec4 vCol; out vec4 o;
void main(){ vec2 d = gl_PointCoord - 0.5; float q = dot(d, d) * 4.0; float a = (exp(-q * 3.0) + 0.30 * exp(-q * 1.1)) * (1.0 - smoothstep(0.75, 1.0, q)); o = vec4(vCol.rgb * a, 0.0); }`;

  const FS_OCCLUDED_DOTS = `#version 300 es
precision highp float;
in vec4 vCol;
in vec3 vDiskView;
in float vPointDiameter;
in float vHalo;
uniform float uHoleR, uOccl;
out vec4 o;
void main(){
  // Test every covered fragment against the front surface of the spherical hole.
  // Foreground dots survive only where their view-space depth is in front of it.
  // During the dive the tunnel is drawn as one full pass, so this test is switched off (uOccl = 0).
  vec2 fragmentPos = vDiskView.xy + (gl_PointCoord - vec2(0.5)) * vPointDiameter;
  float rho2 = dot(fragmentPos, fragmentPos);
  float hr = uHoleR * uOccl;
  float holeR2 = hr * hr;
  if (rho2 < holeR2) {
    float frontSurfaceZ = sqrt(max(holeR2 - rho2, 0.0));
    if (vDiskView.z <= frontSurfaceZ + 0.0002) discard;
  }
  vec2 d = gl_PointCoord - 0.5;
  float q = dot(d, d) * 4.0;
  float a = (exp(-q * 3.0) + (0.30 + 0.80 * vHalo) * exp(-q * 1.1)) * (1.0 - smoothstep(0.75, 1.0, q));   // هالهٔ نرمِ ستاره‌ای برای ذره‌های پرنور
  o = vec4(vCol.rgb * a, 0.0);
}`;

  const VS_AUR_DOTS = `#version 300 es
precision highp float;
in vec2 aPolar;
in vec4 aMisc;   // seed, size, aurora marker, source band
in float aU;     // precomputed offset through the disk thickness
uniform vec2 uView; uniform vec2 uCenter;
uniform float uScale, uSin, uTilt, uPx, uHalf, uDiskBreath, uPhase, uTime;
uniform float uLevel, uLum, uLow, uMid, uHigh, uDim;
uniform float uChroma[12]; uniform float uTint[12];
out vec4 vCol;
out vec3 vViewPos;
out vec2 vProjected;
out float vPointDiameter;
const float CAMERA_DISTANCE = 3.2;
const float TAU_AUR = 6.2831853;
void main(){
  float seed = aMisc.x;
  float sourceBand = clamp(aMisc.w, 0.0, 11.0);
  float baseR = aPolar.x;
  float r = baseR * (1.0 + uDiskBreath * (0.78 + 0.22 * aU));
  float omega = 0.10 * pow(baseR + 0.05, -1.5) + 1.53;
  float theta = aPolar.y - uPhase * omega
    + (0.006 + 0.006 * uMid) * sin(seed * TAU_AUR + uTime * 0.16);
  float x = r * cos(theta), y = r * sin(theta);
  float normalOffset = (aU - 0.5) * 0.070
    + 0.0025 * sin(theta * 3.0 + seed * TAU_AUR + uTime * 0.08);
  float si = clamp(uSin, 0.15, 0.999);
  float ci = sqrt(max(0.0, 1.0 - si * si));
  vec2 view = vec2(x, y * si - normalOffset * ci);
  float depth = y * ci + normalOffset * si;
  float cr = cos(uTilt), sr = sin(uTilt);
  view = vec2(cr * view.x - sr * view.y, sr * view.x + cr * view.y);
  if ((uHalf < 0.5) != (depth < 0.0)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vCol = vec4(0.0); vViewPos = vec3(0.0); vProjected = vec2(0.0); vPointDiameter = 0.0;
    gl_PointSize = 1.0; return;
  }
  float perspective = CAMERA_DISTANCE / max(0.25, CAMERA_DISTANCE - depth);
  vViewPos = vec3(view, depth);
  vProjected = view * perspective;
  vec2 px = uCenter + vProjected * uScale;
  gl_Position = vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);

  float chroma = clamp(uChroma[int(sourceBand + 0.5)], 0.0, 1.0);
  vec3 cyan = vec3(0.08, 0.62, 0.94);
  vec3 violet = vec3(0.40, 0.38, 0.91);
  vec3 color = mix(vec3(0.80, 0.83, 0.90) * (0.30 + 0.22 * seed * seed), mix(cyan, violet, 0.18 + 0.52 * seed), clamp(uTint[int(sourceBand + 0.5)], 0.0, 1.0));
  float depthLight = clamp(0.88 + 0.22 * depth, 0.72, 1.08);
  float audioGlow = clamp(0.82 + 0.16 * uLow + 0.12 * uMid + 0.04 * uHigh, 0.72, 1.12);
  float slowActivity = 0.91 + 0.09 * sin(uTime * 0.23 + seed * 39.0 + theta * 0.35);
  float lum = (0.20 + 0.30 * uLevel) * (0.72 + 0.28 * chroma) * depthLight * audioGlow * slowActivity * uLum * uDim;
  vCol = vec4(color * lum, 0.0);
  gl_PointSize = clamp(aMisc.y * uPx * perspective * (0.92 + 0.10 * uMid), 1.0, 3.5);
  vPointDiameter = gl_PointSize / max(uPx * uScale, 0.001);
}`;

  const FS_AUR_DOTS = `#version 300 es
precision highp float;
in vec4 vCol;
in vec3 vViewPos;
in vec2 vProjected;
in float vPointDiameter;
uniform float uHoleR;
out vec4 o;
const float CAMERA_DISTANCE = 3.2;
void main(){
  // Perspective ray/sphere test: discard only when the black hole is before this particle.
  vec2 projected = vProjected + (gl_PointCoord - vec2(0.5)) * vPointDiameter;
  vec3 ray = vec3(projected / CAMERA_DISTANCE, -1.0);
  float qa = dot(ray, ray);
  float discriminant = CAMERA_DISTANCE * CAMERA_DISTANCE
    - qa * (CAMERA_DISTANCE * CAMERA_DISTANCE - uHoleR * uHoleR);
  if (discriminant >= 0.0) {
    float nearHit = (CAMERA_DISTANCE - sqrt(discriminant)) / qa;
    float particleT = CAMERA_DISTANCE - vViewPos.z;
    if (nearHit >= 0.0 && nearHit < particleT - 0.0002) discard;
  }
  vec2 d = gl_PointCoord - 0.5;
  float q = dot(d, d) * 4.0;
  float a = (exp(-q * 3.0) + 0.30 * exp(-q * 1.1)) * (1.0 - smoothstep(0.75, 1.0, q));
  o = vec4(vCol.rgb * a, 0.0);
}`;

  const FS_HORIZON = `#version 300 es
precision highp float;
uniform vec2 uCanvas; uniform float uPx; uniform vec2 uCenter; uniform float uScale, uHoleR, uLevel, uLum;
uniform float uTime, uEnergy, uBass, uFlare, uAxis; uniform vec3 uTint;
out vec4 o;
float haloHash(float x){ return fract(sin(x * 127.1 + 311.7) * 43758.5453); }
float haloNoise(float a){
  float x = fract(a / 6.2831853) * 12.0, i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(haloHash(mod(i, 12.0) + 1.0), haloHash(mod(i + 1.0, 12.0) + 1.0), f);
}
void main(){
  vec2 p = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y) / uPx - uCenter;
  float R = uHoleR * uScale;
  float d = length(p) / R;
  float a = atan(p.y, p.x);
  float body = (1.0 - smoothstep(0.985, 1.0, d)) * step(0.02, uLevel);   // سطحِ سیاهِ کره تا زمانِ محوشدنِ خودِ کهکشان کاملاً کدر می‌ماند
  float local = haloNoise(a);
  // نورِ لبه دیگر ثابت نیست: لکه‌های روشنِ هاله مثل مادهٔ در حالِ گردش دورِ سیاه‌چاله می‌چرخند،
  // درونِ هاله تندتر از بیرونش (برشِ کپلری ~ d^-1.5) و با موسیقی شتاب می‌گیرند
  float w = pow(max(d, 1.0), -1.5);
  float f1 = 0.5 + 0.5 * sin(2.0 * (a - uTime * 0.34 * w) + 1.3 * sin(a * 3.0 + uTime * 0.21));
  float f2 = 0.5 + 0.5 * sin(7.0 * (a + uTime * 0.16 * w) + 1.7 + 0.8 * sin(a * 4.0 - uTime * 0.17));
  float flow = 0.88 + 0.10 * (2.0 * local - 1.0) + 0.06 * (2.0 * f1 - 1.0) + 0.025 * (2.0 * f2 - 1.0);
  float dop = 1.0 + 0.38 * cos(a - uAxis);                             // سمتِ نزدیک‌شونده روشن‌تر؛ محور آهسته می‌چرخد
  float uneven = 0.55 * sin(2.0 * a + uTime * 0.08) + 0.30 * sin(5.0 * a - uTime * 0.053) + 0.15 * sin(9.0 * a + uTime * 0.027);
  float edge = 1.05 + 0.018 * uneven + 0.012 * (local - 0.5);
  float radial = d - edge;
  float width = (0.110 + 0.022 * uEnergy + 0.009 * uBass) * (0.84 + 0.32 * local);
  float innerGlow = exp(-pow(max(-radial, 0.0) / (width * 0.92), 1.50));
  float outerGlow = exp(-pow(max(radial, 0.0) / (width * (1.24 + 0.18 * local)), 1.38));
  float radialGlow = radial < 0.0 ? innerGlow : outerGlow;
  float brightnessVariation = clamp(0.78 + 0.20 * local + 0.035 * sin(3.0 * a + uTime * 0.06), 0.70, 1.0);
  float breathe = 0.97 + 0.03 * sin(uTime * 0.22 + 0.4 * uneven);
  float ring = radialGlow * brightnessVariation * (0.18 + 0.12 * uEnergy + 0.035 * uBass);
  float halo = exp(-max(d - 1.0, 0.0) * (4.8 - 2.0 * uEnergy)) * smoothstep(0.98, 1.035, d) * (0.18 + 0.22 * uEnergy) * (0.94 + 0.06 * brightnessVariation);
  float flare = uFlare * exp(-pow(radial / 0.25, 2.0)) * 0.38;          // ضربهٔ کوتاه، هم‌راستا با لبهٔ نامنظمِ هاله
  vec3 cool = vec3(0.55, 0.78, 1.0);
  vec3 rim = mix(uTint, cool, smoothstep(1.0, 1.35, d) * 0.7);
  float I = (ring + halo) * flow * dop * breathe + flare;
  vec3 col = rim * I * (0.35 + 0.65 * smoothstep(0.0, 0.5, uLevel)) * (0.65 + 0.35 * uLum) * 0.78;
  col *= 1.0 - body;
  o = vec4(col, body);
}`;

  // §ENCHANT اژدهای خفته: پیچِ مارپیچیِ کوچکِ کهربایی-گرم + اخگر + ذراتِ ریز + دو موجِ شوکِ بیدارشدن. فقط بیرونِ کره (d>1) می‌کشد.
  const FS_ENCHANT = `#version 300 es
precision highp float;
uniform vec2 uCanvas; uniform float uPx; uniform vec2 uCenter; uniform float uScale, uHoleR;
uniform float uTime, uFlow, uAura, uSwell, uSqueeze, uR1, uA1, uR2, uA2;
out vec4 o;
float eHash(float x){ return fract(sin(x * 127.1 + 311.7) * 43758.5453); }
float eHash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float eNoise(float a, float seed){
  float x = fract(a / 6.2831853) * 8.0, i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(eHash(mod(i, 8.0) + seed), eHash(mod(i + 1.0, 8.0) + seed), f);
}
void main(){
  vec2 q = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y) / uPx - uCenter;
  float R = uHoleR * uScale;
  vec2 pd = q / R;
  float d = length(pd);
  if (d < 1.0) { o = vec4(0.0); return; }
  float a = atan(pd.y, pd.x);
  float t = uTime;
  float k = d - 1.0;
  float mask = smoothstep(1.0, 1.035, d) * (1.0 - smoothstep(4.4, 6.0, d));
  vec3 deep = vec3(0.30, 0.14, 0.05), ice = vec3(1.00, 0.84, 0.56), ember = vec3(1.00, 0.46, 0.18);
  vec3 amber = vec3(1.00, 0.62, 0.24);
  float breathe = 0.90 + 0.10 * sin(t * 0.40);
  float gain = uAura * breathe;
  float wake = uSwell;

  float n1 = eNoise(a + t * 0.05, 3.0);
  float veil = (0.85 * exp(-k * (3.4 + 2.0 * uSqueeze)) + 0.28 * exp(-k * 1.1)) * (0.82 + 0.18 * n1);
  vec3 col = mix(deep, amber, exp(-k * 2.6)) * veil * (gain * 0.62 + wake * 0.45);

  float aa = mod(a + 3.14159265 - uFlow * 0.045, 6.2831853);
  float body = 0.0, knots = 0.0;
  for (int n = 0; n < 2; n++) {
    float s = aa + 6.2831853 * float(n);
    float tt = s / 10.6;
    if (tt > 1.0) continue;
    float rc = 1.16 + 1.25 * pow(tt, 0.85) + 0.07 * sin(s * 1.9 - uFlow * 1.1) + 0.025 * sin(s * 5.1 + uFlow * 0.7);
    float w = mix(0.130, 0.030, smoothstep(0.0, 1.0, tt));
    float dist = d - rc;
    float core = exp(-pow(dist / w, 2.0));
    float pulse = (0.50 + 0.50 * sin(s * 2.6 - uFlow * 1.6)) * (0.50 + 0.50 * eNoise(s * 0.9 + uFlow * 0.05, 5.0)) + 0.18;
    float fade = smoothstep(0.0, 0.06, tt) * (1.0 - smoothstep(0.66, 1.0, tt));
    float scale = 0.78 + 0.22 * abs(sin(s * 24.0)) * (0.5 + 0.5 * cos(dist / w * 2.2));
    body += core * pulse * fade * scale;
    knots += core * fade * pow(max(0.0, sin(s * 1.9 + 1.3)), 14.0);
  }
  float dg = gain * 0.80 + wake * 0.90;
  col += mix(deep * 2.2, amber, clamp(body * 0.9, 0.0, 1.0)) * body * dg * 0.70;
  col += ice * knots * dg * 0.38;

  float ah = -3.14159265 + 0.64 + uFlow * 0.045;
  vec2 hp = vec2(cos(ah), sin(ah)) * 1.20;
  float he = exp(-dot(pd - hp, pd - hp) / 0.010);
  col += ember * he * (0.16 + 0.84 * wake) * (0.80 + 0.20 * sin(t * 0.7)) * (0.35 + 0.65 * gain + wake);

  float ph = exp(-pow((d - 1.03) / 0.026, 2.0)) * (0.7 + 0.3 * sin(7.0 * a - t * 0.6));
  col += ice * ph * (gain * 0.20 + wake * 0.26);

  float rr = k * 7.0;
  float cr = floor(rr), cf = fract(rr);
  float dirn = (mod(cr, 2.0) < 1.0) ? 1.0 : -1.0;
  float ang = fract(a / 6.2831853 + t * (0.03 + 0.025 * eHash(cr)) * dirn / (1.0 + 0.5 * cr));
  float cells = 26.0 + 11.0 * cr;
  float ca = floor(ang * cells), cfa = fract(ang * cells);
  float hh = eHash2(vec2(ca, cr + 7.0));
  float present = step(0.90, hh);
  float tw = 0.5 + 0.5 * sin(t * (0.8 + 2.0 * hh) + hh * 40.0);
  float mote = present * smoothstep(0.26, 0.0, length(vec2(cfa - 0.5, cf - 0.5))) * (0.30 + 0.70 * tw) * exp(-k * 0.5);
  col += mix(ice, vec3(1.0), 0.35) * mote * (gain * 0.50 + wake * 0.40);

  float w1 = 0.10 + 0.05 * uR1, w2 = 0.11 + 0.045 * uR2;
  float ring1 = uA1 * smoothstep(1.0, 1.7, uR1) * exp(-pow((d - uR1) / w1, 2.0)) * (0.84 + 0.16 * sin(6.0 * a + uR1 * 3.0));
  float ring2 = uA2 * smoothstep(1.0, 1.7, uR2) * exp(-pow((d - uR2) / w2, 2.0)) * (0.84 + 0.16 * sin(5.0 * a - uR2 * 2.5 + 1.0));
  vec3 rc1 = mix(vec3(1.00, 0.88, 0.66), amber, clamp((uR1 - 1.0) / 2.4, 0.0, 1.0));
  vec3 rc2 = vec3(0.95, 0.62, 0.30);
  col += rc1 * ring1 + rc2 * ring2;

  col = min(col, vec3(1.10)) * mask;
  o = vec4(col, 0.0);
}`;

  const VS_POWDER = `#version 300 es
precision highp float;
in vec2 aS; in vec3 aR; in float aG;   // aG: ۰ = عنوان/هنرمند، ۱ = ستارهٔ امتیاز
uniform vec2 uView; uniform vec2 uCenter; uniform float uProg, uApp, uSin, uPx, uBoxX, uBoxW, uMode, uEnter, uCoreR, uFade, uHasStars;
out vec4 vCol;
void main(){
  if (uMode > 0.5) {
    float delay = clamp((aS.x - uBoxX) / max(uBoxW, 1.0), 0.0, 1.0) * 0.15 + aR.x * 0.10 + aG * 0.10;   // ستاره‌ها کمی بعد از عنوان
    float t = clamp((uEnter - delay) / max(0.01, 1.0 - delay), 0.0, 1.0);
    vec2 v = aS - uCenter;
    float dist = length(v);
    vec2 dir = dist > 0.001 ? v / dist : vec2(cos(aR.y * 6.28318), sin(aR.y * 6.28318));
    float turn = (aR.y - 0.5) * 0.30;
    dir = vec2(dir.x * cos(turn) - dir.y * sin(turn), dir.x * sin(turn) + dir.y * cos(turn));
    float coreR = max(3.0, uCoreR);
    vec2 p0 = uCenter + dir * coreR;
    float reach = min(max(coreR + 18.0, dist * 1.12), coreR + 180.0);
    vec2 p1 = uCenter + dir * mix(coreR + 8.0, reach, 0.72 + 0.28 * aR.z);
    vec2 pos = p0 * (1.0 - t) * (1.0 - t) + p1 * (2.0 * (1.0 - t) * t) + aS * t * t;
    float alpha = uApp * uFade * (0.72 + 0.28 * smoothstep(0.0, 0.32, t));
    vec3 warm = mix(vec3(1.0, 0.78, 0.48), vec3(1.0, 0.94, 0.80), smoothstep(0.05, 0.82, t));
    warm = mix(warm, vec3(1.0, 0.88, 0.60), aG * 0.6);
    vCol = vec4(warm * alpha, 0.0);
    gl_Position = vec4(pos.x / uView.x * 2.0 - 1.0, 1.0 - pos.y / uView.y * 2.0, 0.0, 1.0);
    gl_PointSize = max(1.0, (1.35 + 0.9 * aR.z) * uPx * (1.0 + 0.35 * (1.0 - t)));
    return;
  }
  // با ستاره: اول تمامِ عنوان/هنرمند (تا ۰٫۴۸) و بعد ستاره‌ها از چپ به راست (از ۰٫۵۰ تا ۰٫۹۲) به سیاه‌چاله می‌روند
  bool st = uHasStars > 0.5;
  float delay = clamp((aS.x - uBoxX) / max(uBoxW, 1.0), 0.0, 1.0) * (st ? 0.14 : 0.35) + aR.x * (st ? 0.08 : 0.25) + (st ? aG * 0.50 : 0.0);
  float p = clamp((uProg - delay) / (st ? 0.26 : 0.4), 0.0, 1.0);
  float e = p * p * (3.0 - 2.0 * p);
  vec2 v = aS - uCenter;
  float rad = length(v) * pow(1.0 - e, 1.4);
  float ang = atan(v.y, v.x) + (3.0 + 2.2 * aR.y) * e * e;
  vec2 pos = uCenter + vec2(cos(ang), sin(ang)) * rad;
  pos.y = uCenter.y + (pos.y - uCenter.y) * mix(1.0, uSin, e);
  pos += (aR.xy - 0.5) * 26.0 * sin(3.14159 * p);
  float alpha = uApp * (1.0 - smoothstep(0.55, 1.0, p)) * (0.75 + 0.25 * aR.z);
  vec3 warm = mix(vec3(1.0, 0.94, 0.80), vec3(1.0, 0.88, 0.60), aG * 0.6);
  vCol = vec4(warm * alpha, 0.0);
  gl_Position = vec4(pos.x / uView.x * 2.0 - 1.0, 1.0 - pos.y / uView.y * 2.0, 0.0, 1.0);
  gl_PointSize = max(1.0, (1.3 + 1.0 * aR.z) * uPx);
}`;

  function shader(gl, type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
    return s;
  }
  function program(gl, vs, fs, names) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u = {}; names.forEach(function (n) { u[n] = gl.getUniformLocation(p, n); });
    return { p: p, u: u };
  }

  function buildCosmicPoints() {
    const rnd = mulberry32((V.session ^ 0x4C1A7E) >>> 0);
    const data = new Float32Array(COSMIC_GROUPS * (COSMIC_STARS_PER_GROUP + 1) * 4);
    let at = 0;
    for (let group = 0; group < COSMIC_GROUPS; group++) {
      const angle = (group / COSMIC_GROUPS) * TAU + (rnd() - 0.5) * 0.18;
      const radius = 0.34 + rnd() * 0.20;
      const cx = clamp(0.5 + Math.cos(angle) * radius, 0.035, 0.965);
      const cy = clamp(0.49 + Math.sin(angle) * radius * 0.78, 0.035, 0.965);
      V.cosmic.groupDelay[group] = rnd() * 3.6;
      // One dim, fixed star per region preserves a quiet sense of distance.
      data[at++] = clamp(cx + (rnd() - 0.5) * 0.05, 0.01, 0.99);
      data[at++] = clamp(cy + (rnd() - 0.5) * 0.05, 0.01, 0.99);
      data[at++] = rnd(); data[at++] = -1;
      for (let j = 0; j < COSMIC_STARS_PER_GROUP; j++) {
        const spread = 0.012 + rnd() * 0.035;
        data[at++] = clamp(cx + (rnd() - 0.5) * spread * 2.0, 0.01, 0.99);
        data[at++] = clamp(cy + (rnd() - 0.5) * spread * 1.4, 0.01, 0.99);
        data[at++] = rnd(); data[at++] = group;
      }
    }
    return data;
  }

  // ستاره‌های نوارِ راه شیری: موقعیت‌ها با seedِ نشست و هندسهٔ نوار ساخته می‌شوند (نه هر فریم)؛
  // فقط وقتی نشست عوض شود یا اندازهٔ پنجره تغییر کند دوباره آپلود می‌شوند.
  function uploadBandStars() {
    const c = V.cosmic;
    if (!G || !G.bandBuf || !V.vw || !V.vh) return;
    c.bandDirty = false;
    const gl = V.gl, aspect = V.vw / V.vh;
    const rnd = mulberry32((V.session ^ Math.imul(c.sessionCount + 3, 0x85EBCA6B) ^ 0xB4D5) >>> 0);
    const N = V.vw < 700 ? MW.starsMobile : MW.starsDesktop;
    const dx = Math.cos(c.bandAngle), dy = Math.sin(c.bandAngle), nx = -dy, ny = dx;
    const halfLen = Math.hypot(aspect, 1) * 0.55;
    const data = new Float32Array(N * 4);
    let n = 0, guard = 0;
    while (n < N && guard++ < N * 40) {
      const s = (rnd() * 2 - 1) * halfLen;
      const bulge = Math.exp(-Math.pow((s - c.bandBulge) / 0.34, 2));
      if (rnd() > 0.40 + 0.60 * bulge) continue;
      const d = (rnd() + rnd() + rnd() + rnd() - 2) * 1.56 * c.bandWidth + c.bandOffset;
      const mx = 0.5 * aspect + dx * s + nx * d, my = 0.5 + dy * s + ny * d;
      const x = mx / aspect, y = 1 - my;
      if (x < 0.005 || x > 0.995 || y < 0.005 || y > 0.995) continue;
      const o = n * 4; data[o] = x; data[o + 1] = y; data[o + 2] = rnd(); data[o + 3] = -2; n++;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, G.bandBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n * 4), gl.STATIC_DRAW);
    G.bandCount = n;
  }

  const HOLE_R = 0.11;   // شعاعِ کره (واحدِ R)
  const AURORA_INNER_R = 0.125; // حدِ داخلیِ Aurora؛ در ۵۰° با انبساطِ حداکثر هنوز داخلِ سیلوئت می‌ماند
  function buildGeometry(N) {
    const rnd = mulberry32(V.session);
    const buf = new Float32Array(N * 7);
    const R0 = 0.19, R1 = 0.78, NB = 12;
    const wts = []; let wsum = 0;
    for (let b = 0; b < NB; b++) { const x = 1 + (rnd() - 0.5) * 0.36; wts.push(x); wsum += x; }
    const GAP = 0.05, CASSINI = 0.40;                 // شکافِ بزرگ بینِ نیمهٔ گرم (C…E) و سرد (F…B)
    const unit = (R1 - R0) / (wsum + 10 * GAP + CASSINI);
    const inner = [], outer = []; let cur = R0;
    for (let b = 0; b < NB; b++) {
      inner.push(cur); cur += wts[b] * unit; outer.push(cur);
      cur += (b === 5 ? CASSINI : GAP) * unit;
    }
    const nInner = Math.round(N * 0.04), nDustTotal = Math.round(N * 0.11);
    const nAurora = Math.floor(N * 0.04), nDust = nDustTotal - nAurora, nRing = N - nInner - nDustTotal;
    // سهم هر نوار ∝ مساحتِ تقریبی (چگالی ∝ r^-0.5 تا نوارهای درونی خالی نمانند)
    const area = outer.map(function (o, b) { return Math.pow(o, 1.5) - Math.pow(inner[b], 1.5); });
    const asum = area.reduce(function (a, c) { return a + c; }, 0);
    const auroraInner = inner.slice();
    auroraInner[0] = AURORA_INNER_R;
    const auroraArea = outer.map(function (o, b) { return Math.pow(o, 1.5) - Math.pow(auroraInner[b], 1.5); });
    const auroraAsum = auroraArea.reduce(function (a, c) { return a + c; }, 0);
    const counts = area.map(function (a) { return Math.round(nRing * a / asum); });
    counts[NB - 1] += nRing - counts.reduce(function (a, c) { return a + c; }, 0);
    const th0 = rnd() * TAU;
    // بازوهای مارپیچِ لگاریتمی (دنباله‌دار نسبت به چرخشِ پادساعت‌گرد). انحرافِ استانداردِ زاویه‌ای
    // ≈ ۰٫۱۶rad در مرکز تا ۰٫۳۴rad در لبه (۸٪ تا ۱۶٪ فاصلهٔ بینِ بازوها؛ پیش‌تر ۱۰٪ تا ۲۳٪) و
    // فقط ۱۸٪ ذرات پس‌زمینه‌اند: بازو باید *پیوسته و خوانا* بماند، نه ابری که دورِ مرکز پخش شده است.
    const ARMS = 3, KPITCH = 1.8;
    V.armTh0 = th0; V.armK = KPITCH; V.armN = ARMS;
    const armAngle = function (r) {
      if (rnd() > 0.82) return rnd() * TAU;
      const k = Math.floor(rnd() * ARMS), sg = 0.20 + 0.22 * ((r - R0) / (R1 - R0)), g = (rnd() + rnd() + rnd() - 1.5) * 1.6;
      return th0 + k * TAU / ARMS + KPITCH * Math.log(r / R0) + g * sg;
    };
    let i = 0;
    const put = function (r, band, uu, tier, thA) {
      const o = i * 7, seed = rnd();
      buf[o] = r; buf[o + 1] = thA !== undefined ? thA : i * GOLDEN + th0; buf[o + 2] = seed; buf[o + 3] = 1.25 * (0.55 + 0.9 * seed);
      buf[o + 4] = band; buf[o + 5] = tier; buf[o + 6] = uu; i++;
    };
    for (let b = 0; b < NB; b++) {
      const a0 = Math.pow(inner[b], 1.5), a1 = Math.pow(outer[b], 1.5), ph = rnd(), rl = 3 + Math.floor(rnd() * 3);
      for (let k = 0; k < counts[b]; k++) {
        let r = 0, u = 0;
        for (let t = 0; t < 8; t++) {                                  // رینگلت‌های ریز (کم‌چگالی و پرچگالی) داخلِ هر نوار
          r = Math.pow(a0 + (a1 - a0) * rnd(), 1 / 1.5);
          u = (r - inner[b]) / (outer[b] - inner[b]);
          if (rnd() < 0.86 + 0.14 * (0.5 + 0.5 * Math.cos(TAU * (rl * u + ph)))) break;
        }
        put(r, b, u, 3, armAngle(r));
      }
    }
    for (let k = 0; k < nInner; k++) put(HOLE_R + 0.03 + 0.05 * Math.pow(rnd(), 0.8), 12, rnd(), k % 7);
    // غبارِ لبه: پوسته‌ای درست بیرونِ دیسک تا دهانهٔ تونل (R_MAX=۱٫۴۲ در VS_DOTS). در حالتِ
    // کهکشان پیوسته به داخل می‌ریزد (پوششِ روشنایی‌اش آن‌ها را بیرونِ لبهٔ دیسک خاموش می‌کند،
    // پس سیلوئتِ کرهٔ سیاه دست‌نخورده می‌ماند) و در حالتِ شیرجه همان‌ها غذای تونل می‌شوند.
    for (let k = 0; k < nDust; k++) put(1.00 + 0.32 * rnd(), 13, rnd(), 2 + Math.floor(rnd() * 5));
    V.auroraStart = i; V.auroraN = nAurora;
    for (let k = 0; k < nAurora; k++) {
      const pick = rnd() * auroraAsum; let b = 0, acc = auroraArea[0];
      while (b < NB - 1 && pick > acc) { b++; acc += auroraArea[b]; }
      const a0 = Math.pow(auroraInner[b], 1.5), a1 = Math.pow(outer[b], 1.5);
      const r = Math.pow(a0 + (a1 - a0) * rnd(), 1 / 1.5);
      const o = i * 7, seed = rnd();
      buf[o] = r; buf[o + 1] = rnd() * TAU;
      buf[o + 2] = seed; buf[o + 3] = 0.75 + 0.70 * rnd();
      buf[o + 4] = 14; buf[o + 5] = b; buf[o + 6] = rnd(); i++;
    }
    V.bandIn = new Float32Array(inner); V.bandOut = new Float32Array(outer);
    return buf;
  }

  function initGL() {
    if (V.ok) return true;
    if (V.dead) return false;
    try {
      const root = VM.getRoot();
      if (!root) return false;
      const cv = document.createElement('canvas');
      cv.className = 'vm-viz'; cv.setAttribute('aria-hidden', 'true');
      const gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
      if (!gl) throw new Error('webgl2 unavailable');
      root.insertBefore(cv, root.firstChild);
      V.canvas = cv; V.gl = gl;
      // GPU reset / از دست رفتنِ context: بوم را از نو می‌سازیم (هندسه از seedِ همان نشست دوباره ساخته می‌شود)
      cv.addEventListener('webglcontextlost', function (e) {
        e.preventDefault(); V.ok = false; stopLoop(false);
        setTimeout(guard(function () {
          teardownGL(); V.dead = false;
          if (V.playing && VM.isOpen() && initGL()) startLoop();
        }, 'to:ctx-restore-400ms'), 400);
      });

      G = {};
      G.auroraValid = false;
      G.aurora = program(gl, VS_TRI, FS_AURORA, ['uRes', 'uTime', 'uLevel', 'uSeed', 'uTint', 'uHole', 'uAsp', 'uBend', 'uInfall[0]', 'uInfallTail', 'uHorizon', 'uBand', 'uBandP', 'uBandLow', 'uBloom[0]']);
      G.blit = program(gl, VS_TRI, FS_BLIT, ['uTex', 'uRes', 'uMix']);
      G.cosmic = program(gl, VS_COSMIC_DOTS, FS_COSMIC_DOTS, ['uView', 'uPx', 'uTime', 'uLevel', 'uGlow', 'uAspect', 'uPrimary', 'uReveal[0]', 'uBandTex', 'uBandAmt', 'uBandHigh']);
      G.dots = program(gl, VS_DOTS, FS_OCCLUDED_DOTS, ['uView', 'uCenter', 'uScale', 'uSin', 'uTilt', 'uPx', 'uHalf', 'uDiskBreath', 'uHoleR', 'uPhase', 'uReveal', 'uLum', 'uTime', 'uPulseR', 'uPulseA', 'uDim', 'uMid', 'uHigh', 'uStructure', 'uChroma', 'uPal', 'uAur', 'uAurMix', 'uTint', 'uDive', 'uTravel', 'uCull', 'uOccl']);
      G.aurDots = program(gl, VS_AUR_DOTS, FS_AUR_DOTS, ['uView', 'uCenter', 'uScale', 'uSin', 'uTilt', 'uPx', 'uHalf', 'uDiskBreath', 'uPhase', 'uTime', 'uLevel', 'uLum', 'uLow', 'uMid', 'uHigh', 'uDim', 'uChroma', 'uHoleR', 'uTint']);
      G.hor = program(gl, VS_TRI, FS_HORIZON, ['uCanvas', 'uPx', 'uCenter', 'uScale', 'uHoleR', 'uLevel', 'uLum', 'uTime', 'uEnergy', 'uBass', 'uFlare', 'uAxis', 'uTint']);
    } catch (e) { teardownGL(); V.dead = true; return false; }
    // §ENCHANT برنامهٔ شیدرِ هاله در try جدا: اگر روی یک GPU کامپایل نشد، فقط همین افکت خاموش می‌شود
    try { G.ench = !CFG.enchant ? null : program(V.gl, VS_TRI, FS_ENCHANT, ['uCanvas', 'uPx', 'uCenter', 'uScale', 'uHoleR', 'uTime', 'uFlow', 'uAura', 'uSwell', 'uSqueeze', 'uR1', 'uA1', 'uR2', 'uA2']); } catch (e) { G.ench = null; }
    try {
      const gl = V.gl;
      G.pow = program(gl, VS_POWDER, FS_DOTS, ['uView', 'uCenter', 'uProg', 'uApp', 'uSin', 'uPx', 'uBoxX', 'uBoxW', 'uMode', 'uEnter', 'uCoreR', 'uFade', 'uHasStars']);
      G.emptyVao = gl.createVertexArray();
      G.ejecta = program(gl, VS_EJECTA, FS_EJECTA, ['uView', 'uCenter', 'uScale', 'uSin', 'uTilt', 'uTime', 'uRate', 'uPx', 'uPhase', 'uTh0', 'uK', 'uArms']);
      G.ejectaVao = gl.createVertexArray(); gl.bindVertexArray(G.ejectaVao);
      G.ejectaBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.ejectaBuf); gl.bufferData(gl.ARRAY_BUFFER, buildEjecta(), gl.STATIC_DRAW);
      [['aA', 4, 0], ['aB', 4, 16]].forEach(function (a) { const loc = gl.getAttribLocation(G.ejecta.p, a[0]); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, a[1], gl.FLOAT, false, 32, a[2]); });
      gl.bindVertexArray(null);
      G.comet = program(gl, VS_COMET, FS_COMET, ['uView']);
      G.cometVao = gl.createVertexArray(); gl.bindVertexArray(G.cometVao);
      G.cometBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.cometBuf); gl.bufferData(gl.ARRAY_BUFFER, CM.buf.byteLength, gl.DYNAMIC_DRAW);
      [['aPos', 2, 0], ['aUV', 2, 8], ['aKA', 2, 16], ['aCol', 3, 24]].forEach(function (a) {
        const loc = gl.getAttribLocation(G.comet.p, a[0]); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, a[1], gl.FLOAT, false, 36, a[2]);
      });
      gl.bindVertexArray(null);

      // Sparse distant-star groups are uploaded once; only their reveal weights change per frame.
      const cosmicData = buildCosmicPoints();
      G.cosmicVao = gl.createVertexArray(); gl.bindVertexArray(G.cosmicVao);
      G.cosmicBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.cosmicBuf); gl.bufferData(gl.ARRAY_BUFFER, cosmicData, gl.STATIC_DRAW);
      const cosmicAttr = gl.getAttribLocation(G.cosmic.p, 'aCosmic');
      gl.enableVertexAttribArray(cosmicAttr); gl.vertexAttribPointer(cosmicAttr, 4, gl.FLOAT, false, 16, 0);
      G.cosmicCount = cosmicData.length / 4;
      gl.bindVertexArray(null);
      G.bandVao = gl.createVertexArray(); gl.bindVertexArray(G.bandVao);
      G.bandBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.bandBuf); gl.bufferData(gl.ARRAY_BUFFER, 16, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(cosmicAttr); gl.vertexAttribPointer(cosmicAttr, 4, gl.FLOAT, false, 16, 0);
      G.bandCount = 0; V.cosmic.bandDirty = true;
      gl.bindVertexArray(null);

      // هندسهٔ کهکشان (یک بار)
      V.N = (window.innerWidth < 700) ? CFG.dotsMobile : CFG.dotsDesktop;
      const data = buildGeometry(V.N);
      G.dotVao = gl.createVertexArray(); gl.bindVertexArray(G.dotVao);
      G.dotBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.dotBuf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const l0 = gl.getAttribLocation(G.dots.p, 'aPolar'), l1 = gl.getAttribLocation(G.dots.p, 'aMisc'), l2 = gl.getAttribLocation(G.dots.p, 'aU');
      gl.enableVertexAttribArray(l0); gl.vertexAttribPointer(l0, 2, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(l1); gl.vertexAttribPointer(l1, 4, gl.FLOAT, false, 28, 8);
      gl.enableVertexAttribArray(l2); gl.vertexAttribPointer(l2, 1, gl.FLOAT, false, 28, 24);
      gl.bindVertexArray(null);

      G.aurVao = gl.createVertexArray(); gl.bindVertexArray(G.aurVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, G.dotBuf);
      const a0 = gl.getAttribLocation(G.aurDots.p, 'aPolar'), a1 = gl.getAttribLocation(G.aurDots.p, 'aMisc'), a2 = gl.getAttribLocation(G.aurDots.p, 'aU');
      gl.enableVertexAttribArray(a0); gl.vertexAttribPointer(a0, 2, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(a1); gl.vertexAttribPointer(a1, 4, gl.FLOAT, false, 28, 8);
      gl.enableVertexAttribArray(a2); gl.vertexAttribPointer(a2, 1, gl.FLOAT, false, 28, 24);
      gl.bindVertexArray(null);

      G.tex = gl.createTexture(); G.fbo = gl.createFramebuffer();
      V.ok = true;
      syncQualityMode();
      resizeGL();
      return true;
    } catch (e) { teardownGL(); V.dead = true; return false; }
  }

  // فقط هدفِ رندر (بوم/بافتِ شفق) را با مقیاسِ تازه می‌سازد؛ چیدمان و پودر دست‌نخورده می‌مانند.
  function sizeTarget(rs) {
    const gl = V.gl; if (!gl || !G) return;
    V.rs = rs;
    V.W = Math.max(2, Math.floor(V.vw * rs)); V.H = Math.max(2, Math.floor(V.vh * rs));
    V.canvas.width = V.W; V.canvas.height = V.H;
    G.aw = Math.max(2, Math.ceil(V.W / 4)); G.ah = Math.max(2, Math.ceil(V.H / 4));
    gl.bindTexture(gl.TEXTURE_2D, G.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, G.aw, G.ah, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, G.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, G.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    G.auroraValid = false;
  }

  function resizeGL() {
    if (!V.ok) return;
    if (V.entrance.pending || V.entrance.active) cancelTitleEntrance(true);
    V.vw = window.innerWidth; V.vh = window.innerHeight;
    sizeTarget(pickScale());
    Q.scaleDirty = false;
    Q.scaleCooldown = performance.now() + 1500;
    Q.grace = performance.now() + 2500;
    // هندسهٔ صفحه: سیاه‌چاله کمی بالاتر از وسط؛ در پرتره دیسک «رو به‌تر» می‌شود
    const portrait = V.vw / V.vh < 0.8;
    V.incl = portrait ? 62 : 50;     // زاویهٔ ارتفاعِ دوربین نسبت به صفحهٔ دیسک؛ در step() آرام نوسان می‌کند
    if (!V.breath.ready) { V.breath.pitch = V.incl; V.breath.ready = true; }
    V.scale = portrait ? V.vw * 0.92 : Math.min(V.vw * 0.44, V.vh * 0.95);
    V.cx = V.vw / 2; V.cy = V.vh * (portrait ? 0.40 : 0.45);
    V.powder.key = '';    // پودر باید دوباره نمونه‌برداری شود
    V.cosmic.bandDirty = true;   // نسبتِ تصویر عوض شده؛ ستاره‌های نوار دوباره چیده شوند
  }

  function teardownGL() {
    try { if (V.gl) { const x = V.gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } } catch (e) {}
    try { if (V.canvas && V.canvas.parentNode) V.canvas.parentNode.removeChild(V.canvas); } catch (e) {}
    V.canvas = null; V.gl = null; V.ok = false; G = null;
    V.powder.buf = null; V.powder.vao = null; V.powder.n = 0; V.powder.key = '';
  }

  /* ---------- پودرِ عنوان ---------- */
  function buildPowder() {
    const gl = V.gl;
    const info = VM.getMetaInfo && VM.getMetaInfo();
    if (!info || !info.title) { V.powder.n = 0; return; }
    const items = [info.title, info.artist].filter(Boolean);
    const pts = [];
    const starPts = [];
    items.forEach(function (it) {
      const pad = 4, sc = 2, w = Math.ceil(it.w) + pad * 2, h = Math.ceil(it.h) + pad * 2;
      const c = document.createElement('canvas'); c.width = w * sc; c.height = h * sc;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.scale(sc, sc); g.font = it.font; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      const rtl = RTL.test(it.text);
      try { g.direction = rtl ? 'rtl' : 'ltr'; } catch (e) {}
      g.textAlign = rtl ? 'right' : 'left';
      g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip(); g.fillText(it.text, rtl ? w - pad : pad, h / 2); g.restore();
      const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width;
      for (let y = 0; y < c.height; y += 2) for (let x = 0; x < W; x += 2) {
        if (d[(y * W + x) * 4 + 3] > 110) pts.push(it.x - pad + x / sc, it.y - pad + y / sc);
      }
    });
    // ستاره‌های امتیاز: هر ستاره با همان قلم/اندازهٔ DOM نمونه‌برداری می‌شود تا پودر دقیقاً روی ستارهٔ واقعی بنشیند
    (info.stars || []).forEach(function (st) {
      const sz = st.size || 19, sc = 3, w = Math.ceil(sz * 1.7), h = Math.ceil(sz * 1.7);
      const c = document.createElement('canvas'); c.width = w * sc; c.height = h * sc;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.scale(sc, sc); g.font = (st.font || (sz + 'px sans-serif')); g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillStyle = '#fff';
      g.fillText('\u2605', w / 2, h / 2);
      const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width;
      for (let y = 0; y < c.height; y += 3) for (let x = 0; x < W; x += 3) {
        if (d[(y * W + x) * 4 + 3] > 110) starPts.push(st.x - w / 2 + x / sc, st.y - h / 2 + y / sc);
      }
    });
    let n = pts.length / 2;
    const cap = V.N < 6000 ? 520 : 900;
    const rnd = mulberry32((V.session ^ V.track) >>> 0);
    const idx = []; for (let i = 0; i < n; i++) idx.push(i);
    if (n > cap) { for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; } idx.length = cap; n = cap; }
    const ns = starPts.length / 2, tot = n + ns;
    const data = new Float32Array(tot * 6);
    let minX = 1e9, maxX = -1e9;
    for (let i = 0; i < tot; i++) {
      const isStar = i >= n, s = isStar ? i - n : idx[i];
      const x = isStar ? starPts[s * 2] : pts[s * 2], y = isStar ? starPts[s * 2 + 1] : pts[s * 2 + 1];
      data[i * 6] = x; data[i * 6 + 1] = y; data[i * 6 + 2] = rnd(); data[i * 6 + 3] = rnd(); data[i * 6 + 4] = rnd(); data[i * 6 + 5] = isStar ? 1 : 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
    }
    V.powder.hasStars = ns > 0; n = tot;
    if (!V.powder.vao) V.powder.vao = gl.createVertexArray();
    if (!V.powder.buf) V.powder.buf = gl.createBuffer();
    gl.bindVertexArray(V.powder.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, V.powder.buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const a0 = gl.getAttribLocation(G.pow.p, 'aS'), a1 = gl.getAttribLocation(G.pow.p, 'aR'), a2 = gl.getAttribLocation(G.pow.p, 'aG');
    gl.enableVertexAttribArray(a0); gl.vertexAttribPointer(a0, 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(a1); gl.vertexAttribPointer(a1, 3, gl.FLOAT, false, 24, 8);
    gl.enableVertexAttribArray(a2); gl.vertexAttribPointer(a2, 1, gl.FLOAT, false, 24, 20);
    gl.bindVertexArray(null);
    V.powder.n = n; V.powder.box = [minX, Math.max(1, maxX - minX)];
  }

  function cancelTitleEntrance(reveal) {
    V.entrance.pending = false; V.entrance.active = false; V.entrance.elapsed = 0;
    if (reveal) VM.setPowder(V.powder.on && V.powder.n > 0);
  }

  function startTitleEntrance(detail) {
    if (!detail || !Number.isFinite(detail.generation) || detail.generation === V.entrance.generation) return;
    V.entrance.generation = detail.generation;
    V.entrance.id = detail.id;
    cancelTitleEntrance(true);
    if (!V.playing || !VM.isOpen() || document.hidden || reduced() || V.powder.on) return;
    const audio = VM.getAudio();
    if (!audio || audio.paused || (isFinite(audio.duration) && audio.duration - audio.currentTime <= V.entrance.duration + V.entrance.handoff)) return;
    if (!V.ok && !initGL()) return;
    V.powder.key = '';
    V.entrance.pending = true;
    VM.setPowder(true);
    if (!V.running && V.playing) startLoop();
  }

  function powderState(rem, dur) {
    if (!(V.playing && V.ok && dur > 0 && isFinite(rem)) || reduced()) return { on: false, appear: 0, prog: 0 };
    // کلِ نمایش T = max(۸ ثانیه، ۱/۲۰ طول × ۱٫۱) تا سقفِ نیمِ آهنگ — برای آهنگِ ۴ دقیقه‌ای ≈ ۱۳٫۲ ثانیه
    const T = Math.min(Math.max(CFG.powderMinS, dur / 20 * 1.1), dur * 0.5);
    const end = Math.min(0.9, T * 0.06), hold = clamp(T * 0.18, 2.2, 6);       // مکثِ خواندنِ عنوان قبل از پودر شدن
    if (!(rem < T && rem > end * 0.35)) return { on: false, appear: 0, prog: 0 };
    const e = T - rem;
    return { on: true, appear: clamp(e / 0.9, 0, 1), prog: clamp((e - hold) / Math.max(0.5, T - end - hold), 0, 1), T: T };
  }

  /* ---------- مراحل ---------- */
  function updateStage(dt, nowS) {
    V.stageT += dt; V.tPlay += dt;
    if (reduced()) { V.stage = 'calm'; return; }
    /* §SCENE دروازهٔ صادقِ پله: «galaxy» یعنی موسیقیِ واکنش‌گر با دادهٔ تأییدشده. در دو حالتِ
       تازه (idle بی‌منبع و «منبع هست، پخش نیست») حلقه حالا می‌چرخد و انرژیِ تزئینیِ ambient
       (میانگین ≈ 0.52) از آستانه 0.46 بالا می‌زند؛ بدونِ این دروازه پله از هیچ‌چیز بیدار می‌شد
       و لایه‌های پله‌محور (نشستِ کیهانی/دنباله‌دار) روشن می‌شدند. با scene خاموش رفتارِ قبلی عیناً
       باقی می‌ماند. */
    if (CFG.scene && !V.playing) { V.stage = 'calm'; return; }
    // اگر آنالیز در دسترس نباشد (لایهٔ ambient) انرژیِ ساختگیِ آرام جایگزین می‌شود تا نمایش هرگز «مرده» نماند
    const ambient = FEAT.quality === 'ambient' || V.tier === 'ambient';
    const e = displayEnergy(nowS);
    const fr = ambient ? 1 : FEAT.fluxR, silent = !ambient && FEAT.silent;
    if (V.stage === 'calm') {
      V.calmT += dt;
      if (V.cool > 0) { V.cool -= dt; V.hiT = 0; return; }
      // اگر مدتی در حالتِ آرام ماند، آستانه آرام‌آرام پایین می‌آید؛ صداهای روشن (انرژی در >۲kHz) هم زودتر بیدارش می‌کنند
      const thr = CFG.enterE - 0.22 * clamp((V.calmT - 20) / 60, 0, 1) - 0.07 * clamp((A.bright - 0.22) / 0.30, 0, 1);
      // صداهای واقعاً ضعیف (≈ کمتر از ‑۳۳dBFS) به‌تنهایی کهکشان را بیدار نمی‌کنند؛ شفق جلوست (اگر آهنگ خیلی طولانی ضعیف ماند، بعد از ~۴۵ ثانیه باز هم می‌آید)
      const loudEnough = !A.ok || A.db > -33 || V.calmT > 45;
      const hot = !silent && loudEnough && A.warm <= 0 && (e > thr || (e > CFG.enterFluxE && fr > CFG.enterFluxR));
      V.hiT = hot ? V.hiT + dt : Math.max(0, V.hiT - dt * 2);
      if (V.hiT > CFG.enterHoldS) { V.stage = 'galaxy'; V.stageT = 0; V.hiT = 0; V.loT = 0; V.calmT = 0; }
    } else {
      const cold = silent || (e < CFG.exitE && fr < 1.15);
      V.loT = cold ? V.loT + dt : Math.max(0, V.loT - dt * 2);
      if (V.stageT > CFG.minGalaxyS && V.loT > CFG.exitHoldS) { V.stage = 'calm'; V.stageT = 0; V.cool = CFG.cooldownS; V.loT = 0; }
    }
  }

  function cosmicRand() {
    if (!V.cosmic.rng) V.cosmic.rng = mulberry32((V.session ^ 0x51A7C0) >>> 0);
    return V.cosmic.rng();
  }
  function cosmicPrimaryRadius() {
    if (!V.vh || !V.scale) return 0.12;
    // Covers the bright outer rings at maximum disk breathing and camera scale.
    return V.scale * 0.87 / V.vh + 0.018;
  }
  function cosmicPrimaryCenter() { return [V.cx / Math.max(1, V.vw), 1 - V.cy / Math.max(1, V.vh)]; }
  function cosmicHorizonRadius() { return HOLE_R * V.scale / Math.max(1, V.vh); }
  function beginCosmicSession() {
    const c = V.cosmic;
    if (c.sessionActive || !V.vw || !V.vh) return;
    c.sessionActive = true; c.sessionCount++; c.activeElapsed = 0;
    c.rng = mulberry32((V.session ^ Math.imul(c.sessionCount, 0x9E3779B9) ^ 0x51A7C0) >>> 0);
    c.slotStart.fill(-100); COMETS.length = 0; c.nextCometAt = 4 + cosmicRand() * 3; c.infallTail = 0.21 + cosmicRand() * 0.05;
    c.lastPeakAt = -100; c.peakCandidateUntil = -100;
    // نمایان‌شدنِ راه شیری: اولین چرخه کوتاه و تضمین‌شده؛ بعد از آن به‌صورت دوره‌ای تکرار می‌شود
    c.revelationStart = MW.firstS + cosmicRand() * 2;
    c.revelationAppear = MW.appearS + cosmicRand() * 2;
    c.revelationHold = MW.holdS + cosmicRand() * 8;
    c.revelationFade = MW.fadeS + cosmicRand() * 4;
    c.revelationRest = MW.restMin + cosmicRand() * MW.restRand;
    c.revelationSeed = cosmicRand(); c.revelationEnergy = 0; c.revelationAmount = 0;
    // هندسهٔ نوار (ثابت در کلِ نشست): زاویهٔ ۱۷–۳۵°، فاصله از مرکز تا سیاه‌چاله روی نوارِ روشن نیفتد، برآمدگی روی یک سمت
    c.bandAngle = (cosmicRand() < 0.5 ? -1 : 1) * (0.06 + cosmicRand() * 0.12);      // افقِ کهکشانی: تقریباً افقی
    c.bandOffset = (cosmicRand() < 0.5 ? -1 : 1) * (0.20 + cosmicRand() * 0.08);     // در ثلثِ بالا یا پایین؛ لبه‌ها سیاه‌اند
    c.bandBulge = (cosmicRand() < 0.5 ? -1 : 1) * (0.25 + cosmicRand() * 0.30);
    c.bandWidth = 0.15 + cosmicRand() * 0.04;
    BLOOMS.length = 0; c.nextBloomAt = 7 + cosmicRand() * 5;
    c.bandDirty = true;
  }
  /* ---------- دنباله‌دارها ---------- */
  // ring: دنباله‌دارِ رنگی از بیرونِ صحنه، مارپیچ‌وار به حلقهٔ هم‌رنگِ خود (۱۲ نتِ کهکشان) می‌رسد، کمی روی آن می‌لغزد و محو می‌شود.
  // star: ستارهٔ امتیازِ آهنگ که از زیرِ عنوان کنده می‌شود و در صفحهٔ کهکشان به سیاه‌چاله فرو می‌رود.
  const COMETS = [];
  const BLOOMS = [];
  function spawnBloom(t, amp) {
    if (BLOOMS.length && t - BLOOMS[BLOOMS.length - 1].born < 3) return;     // پشت‌سرهم نشود
    if (BLOOMS.length >= 3) BLOOMS.shift();
    BLOOMS.push({ s: (cosmicRand() * 2 - 1) * 0.75, w: 0.14 + cosmicRand() * 0.12, amp: amp, born: t, dur: 4.5 + cosmicRand() * 2.5 });
  }
  const BLU = new Float32Array(12);
  function bloomUniform(t) {
    BLU.fill(0);
    for (let i = 0; i < BLOOMS.length && i < 3; i++) {
      const b = BLOOMS[i], age = t - b.born; if (age < 0 || age > b.dur) continue;
      const env = smoother5(age / 1.4) * (1 - smoother5((age - (b.dur - 2.2)) / 2.2));
      BLU[i * 4] = b.s; BLU[i * 4 + 1] = b.w; BLU[i * 4 + 2] = b.amp * env;
    }
    return BLU;
  }

  const COMET_LOOK = { width: 0.72, alpha: 0.68, head: 0.5 };   // ضریب‌های ظاهر: ضخامتِ دم / شفافیت / اندازهٔ نقطهٔ سر (۱ = پیش‌فرضِ ظریف)
  V.colorLevel = 0; V.tint = new Float32Array(12);   // رنگ: پیش‌فرض سفید؛ فقط با پخشِ فعال لمسِ رنگ می‌گیرد
  const CM = { N: 34, MAXC: 12, buf: null, px: null, py: null, ds: [], dc: [], POL: [0, 0], xy: [0, 0] };
  CM.buf = new Float32Array(CM.MAXC * (2 * CM.N + 4) * 9); CM.px = new Float32Array(CM.N); CM.py = new Float32Array(CM.N);
  const STAR_RGB = [1.0, 0.92, 0.74];
  function cometPolar(m, q) {
    const P = CM.POL;
    if (m.kind === 'ring') {
      const qA = 0.76;
      // شعاع: شروعِ آرام ← شتابِ میانه ← فرودِ نرم روی حلقه (سرعتِ شعاعی در رسیدن صفر است، پس شکستگی نیست)
      if (q <= qA) { const u = q / qA, f = -1.5 * u * u * u + 2 * u * u + 0.5 * u; P[0] = m.rStart + (m.rRing - m.rStart) * f; P[1] = m.th0 + m.dir * m.turns * TAU * Math.pow(u, 1.2); return; }
      // روی حلقه: سرعتِ زاویه‌ای همان سرعتِ لحظهٔ رسیدن است و نرم کند می‌شود
      const t = (q - qA) / (1 - qA), arc = m.turns * TAU * 1.2 * (1 - qA) / (2 * qA);
      P[0] = m.rRing; P[1] = m.th0 + m.dir * m.turns * TAU + m.dir * arc * (1 - Math.pow(1 - t, 2));
      return;
    }
    const u = clamp(q, 0, 1);
    P[0] = m.r0 + (m.rEnd - m.r0) * Math.pow(u, 1.55) + m.bulge * Math.sin(Math.PI * Math.pow(u, 0.7));   // ابتدا کمی به بیرون می‌چرخد، بعد مارپیچِ رو به مرکز
    P[1] = m.th0 + m.dir * m.turns * TAU * Math.pow(u, 1.1);
  }
  function cometXY(m, q, sc, sI, cs, sn) {
    cometPolar(m, q);
    const r = CM.POL[0], th = CM.POL[1], x = r * Math.cos(th), y = r * Math.sin(th) * sI;
    CM.xy[0] = V.cx + (cs * x - sn * y) * sc; CM.xy[1] = V.cy + (sn * x + cs * y) * sc;
  }
  function cometAlpha(m, q) {
    if (m.kind === 'ring') return smoother5(q / 0.07) * (1 - smoother5((q - 0.88) / 0.12)) * (q > 0.74 ? 1.12 : 1);
    return smoother5(q / 0.06) * (1 - smoother5((q - 0.84) / 0.16));
  }
  function cometInitStar(m, sc, sI, cs, sn) {
    const dx = (m.sx - V.cx) / sc, dy = (m.sy - V.cy) / sc;
    const ux = cs * dx + sn * dy, uy = (-sn * dx + cs * dy) / sI;      // وارونِ تصویرِ صفحهٔ کهکشان
    m.th0 = Math.atan2(uy, ux); m.rEnd = HOLE_R * 0.85;
    m.r0 = Math.max(m.rEnd + 0.12, Math.hypot(ux, uy));
    m.dir = cosmicRand() < 0.5 ? -1 : 1; m.turns = 1.05 + cosmicRand() * 0.3; m.bulge = 0.2 + cosmicRand() * 0.12; m.ready = true;
  }
  function spawnComet(eventTime, boost) {                                // دنباله‌دارِ رنگیِ حلقه‌ای (ثابت در طولِ عمر، قطعی)
    const c = V.cosmic;
    let active = 0; for (let i = 0; i < COMETS.length; i++) if (COMETS[i].kind === 'ring' && eventTime < COMETS[i].born + COMETS[i].dur) active++;
    if (active >= 2 || COMETS.length >= CM.MAXC) return false;
    let idx = Math.floor(cosmicRand() * 12);
    if (A.ok) {                                                          // رنگ = نتِ غالبِ همین لحظه (اغلب)؛ حلقهٔ همان نت در کهکشان
      let top = 0; for (let i = 1; i < 12; i++) if (A.chroma[i] > A.chroma[top]) top = i;
      if (A.chroma[top] > 0.12 && cosmicRand() < 0.75) idx = top;
    }
    for (let k = 0; k < COMETS.length && k < 12; k++) if (COMETS[k].kind === 'ring' && COMETS[k].idx === idx && eventTime < COMETS[k].born + COMETS[k].dur) { idx = (idx + 5) % 12; break; }
    const rRing = V.bandIn && V.bandOut ? (V.bandIn[idx] + V.bandOut[idx]) * 0.5 : 0.2 + 0.05 * idx;
    COMETS.push({ kind: 'ring', idx: idx, born: eventTime, dur: 9 + cosmicRand() * 3, th0: cosmicRand() * TAU, dir: cosmicRand() < 0.5 ? -1 : 1,
      turns: 0.85 + cosmicRand() * 0.5, rStart: 2.05 + cosmicRand() * 0.45, rRing: rRing, tail: 0.17 + cosmicRand() * 0.05, str: clamp(0.55 + boost * 0.8, 0.5, 0.78) });
    return true;
  }
  function cancelStarFlight() { for (let i = COMETS.length - 1; i >= 0; i--) if (COMETS[i].kind === 'star') COMETS.splice(i, 1); }
  function startStarFlight() {
    if (reduced() || !VM.getStarRects) return;
    const rects = VM.getStarRects();
    if (!rects || !rects.length) return;
    const c = V.cosmic; if (!c.sessionActive) beginCosmicSession();
    cancelStarFlight();
    const t0 = c.activeElapsed;
    for (let k = 0; k < rects.length && COMETS.length < CM.MAXC; k++) {
      COMETS.push({ kind: 'star', k: k, idx: -1, born: t0 + 0.12 + k * 0.95, dur: 3.7 + cosmicRand() * 0.5, sx: rects[k].x, sy: rects[k].y, ready: false, gone: false,
        tail: 0.30, str: 0.8, th0: 0, dir: 1, turns: 1.1, r0: 0.4, rEnd: HOLE_R * 0.85, bulge: 0.25 });
    }
  }
  function tickComets(eventTime) {
    for (let i = COMETS.length - 1; i >= 0; i--) {
      const m = COMETS[i];
      if (m.kind === 'star' && !m.gone && eventTime >= m.born) { m.gone = true; try { VM.setStarState && VM.setStarState(m.k, 'gone'); } catch (e) {} }
      if (eventTime > m.born + m.dur) COMETS.splice(i, 1);
    }
  }
  function drawHotSpot(sc, Lg) {
    const gl = V.gl; if (!G.comet || !G.cometVao) return;
    const e = clamp(V.energy || 0, 0, 1), bass = clamp(FEAT.bass, 0, 1);
    const a = Lg * (0.10 + 0.18 * V.colorLevel * (0.4 + e) + 0.16 * bass);
    if (a < 0.003) return;
    const hs = sc * HOLE_R * (4.6 + 1.2 * bass), buf = CM.buf; let o = 0;
    for (let k = 0; k < 4; k++) {
      const u = (k & 1) ? 1 : -1, v = (k & 2) ? 1 : -1;
      buf[o++] = V.cx + u * hs; buf[o++] = V.cy + v * hs; buf[o++] = u; buf[o++] = v; buf[o++] = 3; buf[o++] = a; buf[o++] = 1.0; buf[o++] = 0.76; buf[o++] = 0.42;
    }
    gl.useProgram(G.comet.p); gl.uniform2f(G.comet.u.uView, V.vw, V.vh);
    gl.bindVertexArray(G.cometVao); gl.bindBuffer(gl.ARRAY_BUFFER, G.cometBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf.subarray(0, o));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function drawEjecta(sc, sinI, roll, nowS, rm, air) {
    const gl = V.gl; if (!G.ejecta || !V.armN) return;
    const rate = clamp((V.ejRate + V.ejBurst) * (air === undefined ? 1 : air), 0, 0.95); if (rate < 0.01) return;
    const u = G.ejecta.u;
    gl.useProgram(G.ejecta.p); gl.bindVertexArray(G.ejectaVao);
    gl.uniform2f(u.uView, V.vw, V.vh); gl.uniform2f(u.uCenter, V.cx, V.cy); gl.uniform1f(u.uScale, sc); gl.uniform1f(u.uSin, sinI); gl.uniform1f(u.uTilt, roll);
    gl.uniform1f(u.uTime, rm ? 0 : nowS % 6000); gl.uniform1f(u.uRate, rate); gl.uniform1f(u.uPx, V.rs || 1);
    gl.uniform1f(u.uPhase, V.phase + V.track * 3.1); gl.uniform1f(u.uTh0, V.armTh0); gl.uniform1f(u.uK, V.armK); gl.uniform1f(u.uArms, V.armN);
    gl.drawArrays(gl.POINTS, 0, EJ.M);
  }
  function drawComets(sc, sinI, roll, La) {
    const gl = V.gl; if (!G.comet || !G.cometVao || !COMETS.length) return;
    const c = V.cosmic, t = c.activeElapsed, N = CM.N, buf = CM.buf, px = CM.px, py = CM.py;
    const cs = Math.cos(roll), sn = Math.sin(roll), sI = Math.max(0.25, sinI), life = clamp(La * 2.5, 0, 1);
    let o = 0, nd = 0;
    for (let mi = 0; mi < COMETS.length; mi++) {
      const m = COMETS[mi], age = t - m.born;
      if (age < 0 || age > m.dur) continue;
      const q = age / m.dur;
      if (m.kind === 'star' && !m.ready) cometInitStar(m, sc, sI, cs, sn);
      const headA = cometAlpha(m, q) * m.str * life * COMET_LOOK.alpha;
      if (headA < 0.004) continue;
      let r, g, b;
      if (m.kind === 'ring') { r = PAL[m.idx * 3] * 0.62 + 0.38; g = PAL[m.idx * 3 + 1] * 0.62 + 0.38; b = PAL[m.idx * 3 + 2] * 0.62 + 0.38; }
      else { r = STAR_RGB[0]; g = STAR_RGB[1]; b = STAR_RGB[2]; }
      const tailQ = m.tail * (m.kind === 'ring' && q > 0.76 ? 1 - 0.7 * ((q - 0.76) / 0.24) : 1);
      for (let j = 0; j < N; j++) { cometXY(m, Math.max(0, q - tailQ * j / (N - 1)), sc, sI, cs, sn); px[j] = CM.xy[0]; py[j] = CM.xy[1]; }
      const hw = (m.kind === 'star' ? 2.4 : 2.0) * COMET_LOOK.width, start = o / 9;          // ظریف: روبانِ باریک
      for (let j = 0; j < N; j++) {
        const j0 = j > 0 ? j - 1 : 0, j1 = j < N - 1 ? j + 1 : N - 1;
        let tx = px[j0] - px[j1], ty = py[j0] - py[j1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const nx = -ty, ny = tx, fr = j / (N - 1);
        const w = hw * (1 - 0.88 * fr) + 0.5;
        const a = headA * Math.pow(1 - fr, 2.0) * smoother5((q - tailQ * fr) / 0.03);   // دمِ شفاف‌تر (افتِ تندتر)
        for (let side = -1; side <= 1; side += 2) {
          buf[o++] = px[j] + nx * w * side; buf[o++] = py[j] + ny * w * side; buf[o++] = side; buf[o++] = 0;
          buf[o++] = 0; buf[o++] = a; buf[o++] = r; buf[o++] = g; buf[o++] = b;
        }
      }
      CM.ds[nd] = start; CM.dc[nd] = 2 * N; nd++;
      const hs = (m.kind === 'star' ? 11 : 6) * COMET_LOOK.head * (m.kind === 'star' ? (1 - 0.6 * smoother5((q - 0.7) / 0.3)) : 1), hk = m.kind === 'star' ? 2 : 1, hx = px[0], hy = py[0];
      const hStart = o / 9;
      for (let k = 0; k < 4; k++) {
        const u = (k & 1) ? 1 : -1, v = (k & 2) ? 1 : -1;
        buf[o++] = hx + u * hs; buf[o++] = hy + v * hs; buf[o++] = u; buf[o++] = v; buf[o++] = hk; buf[o++] = headA; buf[o++] = r; buf[o++] = g; buf[o++] = b;
      }
      CM.ds[nd] = hStart; CM.dc[nd] = 4; nd++;
    }
    if (!nd) return;
    gl.useProgram(G.comet.p); gl.uniform2f(G.comet.u.uView, V.vw, V.vh);
    gl.bindVertexArray(G.cometVao); gl.bindBuffer(gl.ARRAY_BUFFER, G.cometBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf.subarray(0, o));
    for (let i = 0; i < nd; i++) gl.drawArrays(gl.TRIANGLE_STRIP, CM.ds[i], CM.dc[i]);
  }

  function awakenDistantGroups(eventTime, tier, strength) {
    const c = V.cosmic;
    if (eventTime > c.wakeUntil + 6 || c.wakeTier === 0) c.wakeStart = eventTime;
    c.wakeTier = Math.max(c.wakeTier, tier);
    c.wakeStrength = Math.max(c.wakeStrength, strength);
    c.wakeUntil = Math.max(c.wakeUntil, eventTime + 5 + tier * 2);
  }
  function updateCosmic(dt, rm, titleAnimation) {
    const c = V.cosmic;
    const active = V.playing && VM.isOpen() && !document.hidden;
    if (!active) return;                       // مکث/پنهان‌بودن: زمانِ رویدادها منجمد می‌ماند و بعد از ازسرگیری همان وضعیت ادامه می‌یابد
    if (!c.sessionActive) beginCosmicSession();
    if (!rm) c.activeElapsed += Math.min(dt, 0.1);
    const eventTime = c.activeElapsed;
    tickComets(eventTime);
    for (let bi = BLOOMS.length - 1; bi >= 0; bi--) if (eventTime > BLOOMS[bi].born + BLOOMS[bi].dur) BLOOMS.splice(bi, 1);
    if (!rm && eventTime >= c.nextBloomAt) { spawnBloom(eventTime, 0.55 + 0.30 * (A.ok ? clamp(A.energy, 0, 1) : 0.4)); c.nextBloomAt = eventTime + 13 + cosmicRand() * 14; }
    const energyNow = A.ok ? clamp(A.energy, 0, 1) : 0.4;
    // دنباله‌دارها دیگر منتظر اوج نمی‌مانند: زمان‌بندِ پایه، موسیقی فقط فاصله را کمی کوتاه می‌کند
    if (!rm && eventTime >= c.nextCometAt) {
      if (spawnComet(eventTime, 0.10 * energyNow)) c.nextCometAt = eventTime + (MW.cometGapS + cosmicRand() * MW.cometGapRand) * (1.15 - 0.5 * energyNow);
      else c.nextCometAt = eventTime + 1.5;     // هر سه اسلات مشغول است؛ کمی بعد دوباره امتحان کن
    }
    if (!rm && !titleAnimation) {
      // اوج‌های واقعی: onset از رابطهِ FEAT (شارِ طیفی یا قلهٔ غلبهٔ بیس، با دورهٔ بازیابی) — نه افزایشِ حجم
      if (FEAT.onset) c.peakCandidateUntil = eventTime + 0.75;
      const energy = clamp(V.energy || 0, 0, 1);
      const rising = energy > c.prevEnergy + 0.006 || energy > 0.92;
      if (FEAT.live && eventTime <= c.peakCandidateUntil && energy >= 0.68 && rising && eventTime - c.lastPeakAt >= 18) {
        c.lastPeakAt = eventTime;
        c.peakCandidateUntil = -100;
        const exceptional = energy >= 0.90 && FEAT.onsetStrength >= 0.45;
        const tier = exceptional ? 3 : (energy >= 0.78 ? 2 : 1);
        const probability = tier === 3 ? 0.72 : (tier === 2 ? 0.48 : 0.26);
        if (cosmicRand() < probability) {
          c.glow = Math.max(c.glow, 0.24 + 0.20 * energy);
          V.ejBurst = Math.min(0.5, V.ejBurst + (tier === 3 ? 0.40 : (tier === 2 ? 0.28 : 0.16)));
          spawnBloom(eventTime, tier === 3 ? 1.0 : (tier === 2 ? 0.8 : 0.6));
          if (tier >= 2) awakenDistantGroups(eventTime, tier, tier === 3 ? 0.62 : 0.36);
          if (tier === 1 || cosmicRand() < (tier === 3 ? 0.48 : 0.30)) spawnComet(eventTime, tier === 3 ? 0.22 : (tier === 2 ? 0.16 : 0.10));
        }
      }
    }
    c.prevEnergy = A.ok ? (V.energy || 0) : 0;
    c.glow *= Math.exp(-dt * (rm ? 1.2 : 0.22));
    const count = c.wakeTier === 3 ? COSMIC_GROUPS : (c.wakeTier === 2 ? 10 : 4);
    const fadeAt = c.wakeUntil + 6;
    const fade = 1 - smoother5((eventTime - c.wakeUntil) / 6);
    for (let i = 0; i < COSMIC_GROUPS; i++) {
      let target = 0;
      if (!rm && i < count && eventTime < fadeAt) {
        const rise = smoother5((eventTime - c.wakeStart - c.groupDelay[i]) / 2.8);
        target = c.wakeStrength * rise * fade;
      }
      c.reveal[i] += (target - c.reveal[i]) * expK(dt, target > c.reveal[i] ? 1.2 : 3.8);
    }
    if (eventTime >= fadeAt) { c.wakeTier = 0; c.wakeStrength = 0; }
    // راه شیری: نوردهیِ پایهٔ همیشگی + چرخه‌های دوره‌ایِ «نمایان‌شدن» (ظهور ← شکوه ← محو تا نوردهیِ پایه). به شدتِ موسیقی وابسته نیست.
    const cycleLen = c.revelationAppear + c.revelationHold + c.revelationFade;
    const age = eventTime - c.revelationStart;
    let env = 0;
    if (!rm && age >= 0) {
      const a = age % (cycleLen + c.revelationRest);
      if (a < cycleLen) env = smoother5(a / c.revelationAppear) * (1 - smoother5((a - c.revelationAppear - c.revelationHold) / c.revelationFade));
    }
    const target = rm ? MW.base * 0.8 : MW.base + (1 - MW.base) * env;
    c.revelationAmount += (target - c.revelationAmount) * expK(dt, 1.2);
    c.revelationEnergy += (clamp(V.energy || 0, 0, 1) - c.revelationEnergy) * expK(dt, 1.6);
  }
  function resetCosmicNarrative() {
    const c = V.cosmic;
    c.nextCometAt = 0; c.lastPeakAt = -100; c.peakCandidateUntil = -100; c.prevEnergy = 0;
    c.wakeStart = -100; c.wakeUntil = -100; c.wakeTier = 0; c.wakeStrength = 0; c.glow = 0;
    c.slotStart.fill(-100); c.infallUniforms.fill(0); c.reveal.fill(0); COMETS.length = 0; BLOOMS.length = 0;
    c.sessionActive = false; c.activeElapsed = 0; c.revelationStart = 0; c.revelationAmount = 0; c.revelationEnergy = 0; c.rng = null;
  }

  function step(dt, nowS) {
    const audio = VM.getAudio();
    const dur = audio && isFinite(audio.duration) ? audio.duration : 0;
    const rem = dur ? dur - audio.currentTime : Infinity;
    const pst = powderState(rem, dur);
    V.powder.on = pst.on; V.powder.appear = pst.appear; V.powder.prog = pst.prog; V.powder.T = pst.T || 0;
    if (V.entrance.active || V.entrance.pending) {
      if (pst.on || !V.playing || !VM.isOpen() || document.hidden || reduced()) cancelTitleEntrance(false);
      else if (V.entrance.active) V.entrance.elapsed += dt;
    }
    if (V.entrance.active && V.entrance.elapsed >= V.entrance.duration + V.entrance.handoff) { startStarFlight(); cancelTitleEntrance(false); }
    VM.setPowder((pst.on && V.powder.n > 0) || (V.entrance.active && V.entrance.elapsed < V.entrance.duration + V.entrance.handoff));

    const needSpec = V.L.galaxy > 0.02 || V.stage === 'galaxy' || pst.on;
    const audioLive = playSignal(audio);                          // §1.1 منبعِ تب: از stream؛ منبعِ محلی: از paused
    if (A.ok && V.playing && audioLive) { anCount(false); analyze(dt, needSpec); }
    tierUpdate(dt);                                               // §AMBIENT پیش از FEAT: لایه تعیین می‌کند quality چه ادعایی دارد
    showUpdate(dt, nowS);                                         // §SHOW کارگردانِ ambient (پیش از updateStage: منحنیِ تزئینی را همان فریم شکل می‌دهد)
    updateFeatures(dt, V.playing && audioLive, nowS);
    updateStage(dt, nowS);

    const rm = reduced();
    let energy = displayEnergy(nowS);                             // §AMBIENT واقعی / تزئینی / مخلوطِ نرم
    energy = V.energy = (V.energy || 0) + (energy - (V.energy || 0)) * expK(dt, 0.25);
    updateCosmic(dt, rm, pst.on || V.entrance.pending || V.entrance.active);

    if (!V.playing) {
      const k = Math.exp(-dt / 0.55);
      A.low *= k; A.mid *= k; A.high *= k;
    }

    const soft = 1 - energy;
    /* §IDLE blend: در حالتِ «صدا هست، موسیقی نیست» هر دو لایه با وزنِ idleX به صفر می‌روند؛
       شفق و کهکشان. چون ستاره‌ها/دنباله‌دارها/ذراتِ جداشده/.hot-spot همه از همین دو آستانه
       (LaAir و Lg) گذر می‌کنند، یک blendِ خطی کافی است تا «هیچ کهکشانی» بماند — بدونِ دروازهٔ
       تازه در رسم و بدونِ پرش: آمدنِ موسیقی = idleX پایین و Lg بالا ⇒ دقیقاً همان عددِ همیشگی. */
    const idleW = (CFG.idleHalo && !dormantOn()) ? clamp(V.idleX, 0, 1) : 0;   // §DORMANT: با کهکشانِ خفته، idle دیگر Lg را صفر نمی‌کند
    const aT = (!V.playing ? 0 : (V.stage === 'galaxy' ? 0.30 + 0.24 * soft : 0.46 + 0.50 * Math.pow(soft, 1.2) + 0.06 * energy) * (rm ? 0.6 : 1)) * (1 - idleW);
    V.rich += ((V.stage === 'galaxy' ? 0.30 : 0.45 + 0.55 * soft) - V.rich) * expK(dt, 1.2);
    // سیاه‌چاله همیشه (حتی کم‌رنگ و میانِ شفق) حاضر است: با آهنگ بارگذاری‌شده حتی در مکث یک ردِ ملایم می‌ماند
    /* §SCENE blend: «منبع فعال است ولی پخش قطعی نشده» ⇒ عددِ سکونِ کهکشان از holeRest به
       awakenTarget بالا می‌آید و همین دیسکِ همیشگی (uReveal = Lg*1.4-0.1) را بیدار می‌کند؛
       نه لایهٔ تازه، نه عددِ صوتیِ ساختگی. با آمدنِ پخشِ واقعی شاخهٔ قبلی (V.playing) را می‌گیرد،
       با رفتنِ منبع awakenX به صفر برمی‌گردد و دقیقاً همان holeRestِ همیشگی می‌ماند. */
    const awakenW = CFG.scene ? clamp(V.awakenX, 0, 1) : 0;
    const gRest0 = awakenW > 0.0005 ? lerp(CFG.holeRest, awakenTarget(), awakenW) : CFG.holeRest;
    const dormW = dormantOn() ? clamp(V.idleX, 0, 1) : 0;
    const gRest = dormW > 0.0005 ? lerp(gRest0, dormantTarget(), dormW) : gRest0;   // §DORMANT idle: همان دیسکِ موجود، کم‌نور
    const gT = (!V.playing ? gRest : (V.stage === 'galaxy' ? 1 : (pst.on ? 0.8 : CFG.holeBase + 0.25 * energy))) * (1 - idleW);
    V.L.aurora += (aT - V.L.aurora) * expK(dt, aT > V.L.aurora ? 0.9 : (V.playing ? 1.2 : 0.55));
    V.L.galaxy += (gT - V.L.galaxy) * expK(dt, gT > V.L.galaxy ? 0.45 : (V.playing ? 1.4 : 0.8));
    V.L.lum += ((0.35 + 0.65 * energy) - V.L.lum) * expK(dt, 0.3);

    // دورانِ دیفرانسیلیِ بسیار نرم (فازِ مشترک؛ سرعتِ هر نقطه از ω(r) در شیدر)
    V.phase += dt * 0.0065 * (1 + 1.0 * energy);
    // Multi-scale, deterministic drift changes disk density over long sessions without rebuilding geometry.
    // میدرنج هم عمقِ همان موج‌های چگالی را تعیین می‌کند (حرکتِ ساختاری ← مید)، نه فقط زمانِ ساعتِ دیوار.
    const drift = 0.56 * Math.sin(nowS * 0.0217 + V.seed3[0] * TAU) + 0.29 * Math.sin(nowS * 0.0081 + V.seed3[1] * TAU) + 0.15 * Math.sin(nowS * 0.0037 + V.seed3[2] * TAU);
    const structureTarget = V.playing && !rm ? drift * (0.60 + 0.40 * FEAT.mid) + 0.30 * FEAT.mid : 0;
    V.structure += (structureTarget - V.structure) * expK(dt, V.playing && !rm ? 7.0 : 1.8);
    // هالهٔ سیاه‌چاله: زمانِ جریان (با انرژی تندتر)، جرقهٔ ضربه و رنگِ ملایمِ نتِ غالب (حداکثر ۵۵٪ مخلوط)
    // §IDLE: در حالتِ بی‌موسیقی، انرژیِ *حرکتِ هاله* فقط زمانِ قطعی است (idleHaloEnergy) — نه
    // دادهٔ صدا؛ پس هاله آرام می‌چرخد ولی با حرف‌زدنِ کسی نمی‌پرد. idleX=0 ⇒ همان V.energyِ همیشگی.
    V.idleE = idleW > 0 ? idleHaloEnergy() : 0;
    const eMotion = idleW > 0.0005 ? lerp(energy, V.idleE, idleW) : energy;
    V.haloE = eMotion;
    V.haloT += dt * (0.55 + 1.5 * eMotion);
    {
      let sr = 0, sg = 0, sb = 0, sw = 0.0001;
      for (let i = 0; i < 12; i++) { const c = A.chroma[i]; sr += PAL[i * 3] * c; sg += PAL[i * 3 + 1] * c; sb += PAL[i * 3 + 2] * c; sw += c; }
      const k = expK(dt, 0.5);
      V.noteC[0] += (sr / sw - V.noteC[0]) * k; V.noteC[1] += (sg / sw - V.noteC[1]) * k; V.noteC[2] += (sb / sw - V.noteC[2]) * k;
    }
    V.flare *= Math.exp(-dt * 2.2);
    {
      let top = 0; for (let i = 1; i < 12; i++) if (A.chroma[i] > A.chroma[top]) top = i;
      const mixW = FEAT.live ? clamp(FEAT.conf * Math.min(1, A.chroma[top] * 1.2), 0, 1) * 0.55 : 0;
      const k = expK(dt, 0.4);
      for (let c = 0; c < 3; c++) V.tintC[c] += ((WARM[c] * (1 - mixW) + PAL[top * 3 + c] * mixW) - V.tintC[c]) * k;
    }
    if (!A.ok) {                                                  // جایگزینِ تزئینی وقتی آنالیز در دسترس نیست
      for (let i = 0; i < 12; i++) { const s = 0.5 + 0.5 * Math.sin(nowS * 0.9 - i * 0.62); A.chroma[i] = 0.62 * s * s; }
      A.conf = 0.5;
    }
    // رنگ: تصویرِ آغازین و لحظه‌های مکث/بی‌صدایی سفیدِ واقع‌گرایانه است؛ با پخش، هر لایه (نتِ خودش) به‌اندازهٔ انرژیِ همان لحظه لمسِ رنگ می‌گیرد
    {
      const e = clamp(V.energy || 0, 0, 1);
      const colTarget = V.playing ? clamp(0.30 + 1.4 * e, 0, 1) * smoother5((e - 0.012) / 0.05) : 0;
      V.colorLevel += (colTarget - V.colorLevel) * expK(dt, colTarget > V.colorLevel ? 2.0 : 1.3);
      for (let b = 0; b < 12; b++) {
        const want = V.colorLevel * (0.22 + 0.78 * smoother5((A.chroma[b] - 0.04) / 0.5));
        V.tint[b] += (want - V.tint[b]) * expK(dt, want > V.tint[b] ? 0.30 : 1.0);
      }
    }
    /* §SHOW بیداریِ آرایشیِ حلقه‌ها و کششِ آرامِ رنگ. فقط وقتی اجرا می‌شود که کارگردان صاحبِ
       نمایش باشد (لایهٔ ambient + پرچمِ روشن) و وزنش با V.tierX است: در crossfade نرم می‌آید،
       در LIVE و در مسیرِ فایلِ محلی هرگز درگیر نمی‌شود. مقدارِ محاسباتی از زمانِ قطعی می‌آید،
       پس پله‌ای نیست (rate-limit شده) و هیچ‌جا ادعای «ضربانِ موسیقی» نمی‌کند. */
    if (showOwnsDisplay()) {
      const sh = V.show, w = clamp(SHOW.tintW * sh.level * V.tierX, 0, 1);
      if (w > 0.001) for (let b = 0; b < 12; b++) { const wt = w * sh.wake[b] * (0.55 + 0.45 * sh.env); if (wt > V.tint[b]) V.tint[b] = wt; }
      const hm = clamp(SHOW.hueMix * sh.level * (0.5 + 0.5 * sh.env), 0, 0.55), hk = expK(dt, 2.4), hi = sh.hueIdx * 3;
      for (let c = 0; c < 3; c++) V.tintC[c] += hm * (PAL[hi + c] - V.tintC[c]) * hk;
    }
    {   // نرخِ جداشدنِ ستاره‌ها از بازوها: با انرژیِ موسیقی؛ اوج‌ها فوران می‌دهند و سریع فرو می‌نشینند (صحنه شلوغ نمی‌شود)
      const e2 = clamp(V.energy || 0, 0, 1), rt = V.playing ? clamp(0.10 + 0.50 * e2, 0, 0.7) : 0;
      V.ejRate += (rt - V.ejRate) * expK(dt, rt > V.ejRate ? 1.6 : 1.2);
      V.ejBurst = Math.max(0, V.ejBurst - dt * 0.5);
    }
    // دوربین: شیبِ دیسک و رولِ بسیار کند — حسِ شناور بودن در فضا (دوره‌ها ≈ ۱۲۰ و ۹۰ ثانیه)
    V.inclNow = V.incl + 6 * Math.sin(nowS * 0.052);
    V.rollNow = V.tilt + 0.05 * Math.sin(nowS * 0.07 + 1.3);
    // روایتِ دوربین (§3): یک گشایش در آغازِ واقعیِ پخش، سپس «خانه» = دیسکِ تمام‌گشاده که
    // ماندگارِ سفر است، و رویدادهای تونل که روی اوجِ موسیقی بلند می‌شوند و به همان کف برمی‌گردند.
    // درِ کرم‌چاله را فقط پایانِ واقعیِ پخش یا خروج از Music Mode می‌بندد؛ مکث، عنوان، پودر
    // و رسیدنِ اطلاعاتِ تب نه می‌بندندش و نه از نو باز می‌کنند.
    // §IDLE: روایتِ دوربین برای «صدا بدونِ موسیقی» آغاز نمی‌شود — نه گشایش، نه رویدادِ تونل
    // (هیچ‌کدام در این حالت دیده نمی‌شوند و خرجِ بیدوراندنشان هم نیست). موسیقی که بیاید، idleAudio
    // صفر می‌شود و روایت از همان نقطه‌ای که همیشه شروع می‌شد شروع می‌کند.
    const openingActive = V.playing && VM.isOpen() && !document.hidden && !rm && !V.idleAudio;
    if (openingActive && !V.opening.started) startCinematicOpening();
    const narrating = !pst.on && !V.entrance.pending && !V.entrance.active;
    const inGate = openingActive && V.opening.started && narrating;
    if (inGate) V.opening.elapsed += dt;
    const cycleS = Math.max(1, V.opening.cycleS || BREATH.maxCycleS);
    const eventS = Math.max(1, V.opening.eventS || 12);
    // طولِ رویدادِ در جریان فریز می‌شود (evLen): آهنگِ تازه نباید وسطِ یک صعود/فرود منحنی را بشکند
    const evLen = Math.max(1, V.opening.evLen || eventS);
    const openS = Math.max(2, V.opening.openS || 12);
    if (V.opening.phase === 'open') {
      if (V.opening.elapsed >= openS) {
        V.opening.phase = 'travel'; V.opening.cam = 1;
        V.opening.nextAt = V.opening.elapsed + Math.max(6, cycleS * 0.25);
      }
    } else if (V.opening.phase === 'travel') {
      // رویداد به نزدیک‌ترین اوج قفل می‌شود؛ موسیقیِ بی‌اوج پس از DIVE.eventWaitS آن را
      // خودکار آغاز می‌کند، پس حرکتِ پایه هیچ‌وقت وابسته به ضربان نمی‌ماند.
      if (V.opening.evAt < 0) {
        if (inGate && V.opening.elapsed >= V.opening.nextAt &&
          (FEAT.onset || V.opening.elapsed >= V.opening.nextAt + DIVE.eventWaitS)) { V.opening.evAt = V.opening.elapsed; V.opening.evLen = eventS; }
      } else if (V.opening.elapsed - V.opening.evAt >= evLen || !inGate) {
        V.opening.evAt = -1; V.opening.evLen = 0;
        V.opening.nextAt = V.opening.elapsed + Math.max(8, cycleS - eventS);
      }
    }
    let camProg;
    if (V.opening.phase === 'open') camProg = smoother5(clamp(V.opening.elapsed / openS, 0, 1));
    else {
      // مکثِ موقت در را نمی‌بندد: تا Music Mode باز است دوربین در خانه می‌ماند؛ تنها عنوان و
      // پودر موقتاً بیرونش می‌آورند و پس از آن، بدونِ هیچ گشایشِ دوباره، برمی‌گردد.
      const camTarget = V.opening.started && narrating && VM.isOpen() && !rm ? 1 : 0;
      V.opening.cam += (camTarget - V.opening.cam) * expK(dt, camTarget > V.opening.cam ? DIVE.camIn : DIVE.camOut);
      camProg = clamp(V.opening.cam, 0, 1);
      if (V.opening.phase === 'closing' && camProg < 0.02) { V.opening.phase = 'idle'; V.opening.cam = 0; camProg = 0; }
    }
    V.opening.progress = camProg;
    const evU = V.opening.evAt >= 0 ? (V.opening.elapsed - V.opening.evAt) / evLen : -1;
    const fwd = DIVE.forwardPart;
    const tunnelT = evU < 0 ? 0 : (evU < fwd ? smoother5(evU / fwd) : 1 - smoother5((evU - fwd) / (1 - fwd)));
    // کفِ عمق در پخش (= سفرِ پیوسته) و قله روی رویداد؛ در مکث کف صفر می‌شود تا جریانِ بی‌صدا
    // حرکت نکند، ولی «در» باز می‌ماند و از اولین اوجِ بعدی بی‌درنگ ادامه می‌دهد.
    const diveTarget = inGate ? DIVE.diveBase + (1 - DIVE.diveBase) * tunnelT : 0;
    V.dive += (diveTarget - V.dive) * expK(dt, diveTarget > V.dive ? DIVE.tauIn : DIVE.tauOut);
    if (V.dive < 0.0005) V.dive = 0;
    // جریانِ محوریِ تونل: بی‌رویداد هم حلقه‌ها می‌چرخند (idleShare) و رویداد نرخ را تا DIVE.flow
    // بالا می‌برد؛ انرژیِ موسیقی نرخ را حداکثر ۱۵٪ باز می‌کند. dive=۰ (مکث) ⇒ حرکت هم صفر.
    V.travel += dt * DIVE.flow * (V.dive > 0 ? DIVE.idleShare + (1 - DIVE.idleShare) * V.dive : 0) * (0.85 + 0.15 * FEAT.energy);
    if (V.travel >= TUNNEL_SPAN) V.travel -= TUNNEL_SPAN;
    const openProgress = camProg;
    if (!Number.isFinite(V.breath.pitch)) V.breath.pitch = Number.isFinite(V.incl) ? V.incl : 50;
    if (!Number.isFinite(V.breath.zoom)) V.breath.zoom = 1;
    if (!Number.isFinite(V.breath.mix)) V.breath.mix = 0;
    if (!Number.isFinite(V.breath.disk)) V.breath.disk = 0;
    const pitchTarget = lerp(BREATH.startPitch, BREATH.endPitch, openProgress) + DIVE.pitch * V.dive;
    const zoomTarget = lerp(BREATH.startZoom, BREATH.endZoom, openProgress) + 0.04 * V.dive;
    V.breath.pitch += (pitchTarget - V.breath.pitch) * expK(dt, 0.8);
    V.breath.zoom += (zoomTarget - V.breath.zoom) * expK(dt, 0.8);
    const breathActive = V.playing && VM.isOpen() && !document.hidden && !rm;
    // باس → انبساطِ دیسک (سقف همان ۰٫۱۰ قبلی می‌ماند، فقط بینِ انرژی و باس تقسیم شده)
    const diskBreathTarget = breathActive ? openProgress * (0.055 + 0.025 * clamp(V.energy || 0, 0, 1) + 0.02 * FEAT.bass) * (1 - 0.85 * V.dive) : 0;
    V.breath.disk += (diskBreathTarget - V.breath.disk) * expK(dt, diskBreathTarget > V.breath.disk ? 1.6 : 2.2);
    if (rm) V.breath.mix = 0;
    else V.breath.mix += ((breathActive ? 1 : 0) - V.breath.mix) * expK(dt, 1.8);
    V.tilt += (V.tiltT - V.tilt) * expK(dt, 2.5);
    V.spiralPh += (V.spiralPhT - V.spiralPh) * expK(dt, 2.5);

    // ضربهٔ محدود: حداکثر ~۳ بار در ثانیه، فقط در کهکشان — و فقط از FEAT (رندر چیزی را خودشان محاسبه نمی‌کند)
    if (FEAT.onset && V.stage === 'galaxy' && !rm) {
      V.pulse.t0 = nowS; V.pulse.amp = FEAT.onsetStrength; V.flare = Math.max(V.flare, FEAT.onsetStrength);
    }
  }

  /* §B تابعِ خالصِ آستانه: تنها منبعِ حقیقتِ «چند پاس رسم شود و با چه وزنی».
     draw() از همان یکجا می‌خواند و آزمونِ جعبه‌سیاه هم همان را صدا می‌زند (آینه‌سازیِ مجدد = ریسکِ واگرایی). */
  function splitWeights(d) {
    const at = DIVE.splitAt, soft = Math.max(0.0001, DIVE.splitSoft);
    return { halfW: clamp(1 - (d - (at - soft)) / (2 * soft), 0, 1), hard: d >= at + soft };
  }

  /* ---------- رسم ---------- */
  function draw(nowS) {
    const gl = V.gl;
    const rm = reduced();
    const La = V.L.aurora, Lg = V.L.galaxy;
    // §SHOW کرومایِ آپلودشده: در حالت‌های عینی همان A.chroma است؛ فقط در ambientِ با نمایش روشن،
    // آرایهٔ آرایشیِ جدا (مخلوطی از همان داده + منحنیِ زمان) برمی‌گردد. A.chroma هیچ‌وقت نوشته نمی‌شود.
    const DC = displayChroma();
    const dive = clamp(V.dive || 0, 0, 1);
    // پس‌زمینه فقط تا DIVE.airMin کم‌نور می‌شود؛ صفحه هیچ‌وقت کامل سیاه نمی‌شود.
    const air = 1 - (1 - DIVE.airMin) * smoother5(dive / 0.92);
    const tunnelMode = dive > 0.004;   // فقط کف‌های uReveal/uDim و پاس‌های شفق را تعیین می‌کند (بدونِ تغییرِ رفتار)
    // §REVEAL-RAMP پیش‌تر uReveal در همان فریمِ روشن‌شدنِ tunnelMode از Lg*1.4-0.1 به ۱٫۳۵ می‌پرید و حلقه‌های
    // هنوز-ناآشکار یک‌جا ظاهر می‌شدند. حالا revealK با نرخِ ثابت بالا/پایین می‌رود و smoother5 آن را نرم می‌کند؛
    // با revealK=۰ دقیقاً مقدارِ قبلیِ بیرونِ تونل و با revealK=۱ دقیقاً مقدارِ قبلیِ درونِ تونل برمی‌گردد.
    const revDt = V.revealT > 0 ? clamp(nowS - V.revealT, 0, 0.1) : 0;
    V.revealT = nowS;
    V.revealK = clamp((V.revealK || 0) + (tunnelMode ? 1 : -1) * revDt / REVEAL_RAMP_S, 0, 1);
    const revealForce = smoother5(V.revealK);
    // §B ترتیبِ رسمِ افق دیگر با همین یک بولین عوض نمی‌شود؛ آستانهٔ نرمِ splitAt جای آن را گرفته.
    const sw = splitWeights(dive);
    const LaAir = La * air;
    // §IDLE وزنِ حالتِ «صدا بدونِ موسیقی» (از همان blend در step خوانده می‌شود، نه رأیِ تازه):
    // با idleW=0 همهٔ عبارتهای پایین دقیقاً همان اعدادِ امروزند.
    const idleW = (CFG.idleHalo && !dormantOn()) ? clamp(V.idleX, 0, 1) : 0;   // §DORMANT
    enchStep(nowS, rm);                                           // §ENCHANT ساعتِ هاله + گذارِ شروعِ پخش
    const baseIncl = Number.isFinite(V.inclNow) ? V.inclNow : V.incl;
    const mix = Number.isFinite(V.breath.mix) ? clamp(V.breath.mix, 0, 1) : 0;
    const breathPitch = Number.isFinite(V.breath.pitch) ? clamp(V.breath.pitch, BREATH.startPitch, BREATH.maxPitch) : baseIncl;
    const breathZoom = Number.isFinite(V.breath.zoom) ? clamp(V.breath.zoom, BREATH.startZoom, 1.08) : 1;
    const diskBreath = !rm && Number.isFinite(V.breath.disk) ? clamp(V.breath.disk, 0, 0.10) : 0;
    const cameraPitch = lerp(baseIncl, breathPitch, mix);
    const sinI = Math.sin(cameraPitch * Math.PI / 180);
    const sceneScale = V.scale * lerp(1, breathZoom, mix);
    const rollFade = V.opening.started ? smoother5(V.opening.elapsed / BREATH.rollFadeS) : 0;
    const roll = (V.rollNow || V.tilt) + (rm ? 0 : (1 - rollFade) * BREATH.startRoll);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND);
    if (V.cosmic.bandDirty && G.bandBuf) uploadBandStars();
    // نوار با سطحِ شفق محو می‌شود تا وقتی پخش متوقف می‌شود ناگهان نپرد
    const bandAmt = V.cosmic.revelationAmount * clamp(LaAir * 3.0, 0, 1);

    Q.auroraFrame = (Q.auroraFrame + 1) | 0;
    const auroraDue = !G.auroraValid || (Q.auroraFrame % Math.max(1, Q.auroraEvery)) === 0;
    if (LaAir > 0.003) {
      if (auroraDue) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, G.fbo); gl.viewport(0, 0, G.aw, G.ah);
      gl.disable(gl.BLEND);
      gl.useProgram(G.aurora.p);
      gl.uniform2f(G.aurora.u.uRes, G.aw, G.ah); gl.uniform1f(G.aurora.u.uTime, rm ? 0 : nowS + V.track * 17.0);
      gl.uniform1f(G.aurora.u.uLevel, LaAir);
      gl.uniform3f(G.aurora.u.uSeed, V.seed3[0], V.seed3[1], V.seed3[2]);
      let top = 0; for (let i = 1; i < 12; i++) if (DC[i] > DC[top]) top = i;
      gl.uniform3f(G.aurora.u.uTint, PAL[top * 3], PAL[top * 3 + 1], PAL[top * 3 + 2]);
      gl.uniform2f(G.aurora.u.uHole, V.cx / V.vw, 1 - V.cy / V.vh); gl.uniform1f(G.aurora.u.uAsp, V.vw / V.vh);
      gl.uniform1f(G.aurora.u.uBend, clamp(0.45 + 0.55 * Lg, 0, 1));
      const c = V.cosmic, infall = c.infallUniforms;
      const bandTemp = clamp((A.centroidR - 0.2) / 0.5, 0, 1);
      gl.uniform4f(G.aurora.u.uBand, c.bandAngle, c.bandOffset, c.bandBulge, c.bandWidth);
      gl.uniform4f(G.aurora.u.uBandP, bandAmt, c.revelationSeed, c.revelationEnergy, bandTemp);
      gl.uniform1f(G.aurora.u.uBandLow, rm ? 0 : FEAT.bass);
      gl.uniform4fv(G.aurora.u['uBloom[0]'], bloomUniform(c.activeElapsed));
      infall.fill(0);                                                   // دنباله‌دارها حالا با روبانِ جدا رسم می‌شوند (drawComets)
      gl.uniform4fv(G.aurora.u['uInfall[0]'], infall);
      gl.uniform1f(G.aurora.u.uInfallTail, c.infallTail);
      gl.uniform1f(G.aurora.u.uHorizon, cosmicHorizonRadius());
      gl.bindVertexArray(G.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.BLEND);
      G.auroraValid = true;
      }
    } else G.auroraValid = false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, V.W, V.H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);

    gl.blendFunc(gl.ONE, gl.ONE);
    if (LaAir > 0.003) {
      gl.useProgram(G.blit.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.tex);
      gl.uniform1i(G.blit.u.uTex, 0); gl.uniform2f(G.blit.u.uRes, V.W, V.H); gl.uniform1f(G.blit.u.uMix, 1);
      gl.bindVertexArray(G.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    if (LaAir > 0.003 && G.cosmicVao) {
      const cu = G.cosmic.u;
      gl.useProgram(G.cosmic.p);
      gl.uniform2f(cu.uView, V.vw, V.vh); gl.uniform1f(cu.uPx, V.rs);
      gl.uniform1f(cu.uTime, rm ? 0 : nowS); gl.uniform1f(cu.uLevel, LaAir);
      gl.uniform1f(cu.uGlow, rm ? 0 : V.cosmic.glow);
      gl.uniform1f(cu.uAspect, V.vw / Math.max(1, V.vh));
      const primary = cosmicPrimaryCenter();
      gl.uniform3f(cu.uPrimary, primary[0], primary[1], cosmicPrimaryRadius());
      gl.uniform1fv(cu['uReveal[0]'], V.cosmic.reveal);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.tex); gl.uniform1i(cu.uBandTex, 0);
      gl.uniform1f(cu.uBandAmt, bandAmt); gl.uniform1f(cu.uBandHigh, rm ? 0 : FEAT.treble);
      gl.bindVertexArray(G.cosmicVao); gl.drawArrays(gl.POINTS, 0, G.cosmicCount);
      const bandN = Math.floor(G.bandCount * Q.band);
      if (bandN > 0 && bandAmt > 0.003) { gl.bindVertexArray(G.bandVao); gl.drawArrays(gl.POINTS, 0, bandN); }
    }

    if (LaAir > 0.003 && COMETS.length) drawComets(sceneScale, sinI, roll, LaAir);
    if (Lg > 0.004 && air > 0.02) { drawHotSpot(sceneScale, Lg * air); drawEjecta(sceneScale, sinI, roll, nowS, rm, air); }

    /* §IDLE حلقه‌ها/شفقِ کهکشانی فقط با Lg زنده‌اند؛ هاله پاسِ افقِ *همان* بلوک است. پس بلوک
       وقتی کهکشان رفته هم باز می‌ماند (haloOn) تا سیاه‌چاله و هاله‌اش روی صفحه بمانند، ولی
       هیچ پاسِ نقطه‌ای (dots/aurDots) دیگر اجرا نمی‌شود. آستانه‌ها دست‌نخورده‌اند. */
    const dotsOn = Lg > 0.004;
    const haloOn = idleW > 0.0005;
    if (dotsOn || haloOn) {
      const u = G.dots.u, n = Math.max(1500, Math.floor(V.N * V.q));
      const au = G.aurDots.u, aurN = Math.floor(V.auroraN * V.q);
      const pp = clamp((nowS - V.pulse.t0) / 1.7, 0, 1);
      const setAurDots = function (half) {
        if (LaAir <= 0.003 || aurN <= 0) return;
        gl.useProgram(G.aurDots.p);
        gl.uniform2f(au.uView, V.vw, V.vh); gl.uniform2f(au.uCenter, V.cx, V.cy);
        gl.uniform1f(au.uScale, sceneScale); gl.uniform1f(au.uSin, sinI); gl.uniform1f(au.uTilt, roll); gl.uniform1f(au.uPx, V.rs); gl.uniform1f(au.uHalf, half);
        gl.uniform1f(au.uDiskBreath, diskBreath); gl.uniform1f(au.uPhase, rm ? 0 : V.phase + V.track * 3.1); gl.uniform1f(au.uTime, rm ? 0 : nowS % 6000);
        gl.uniform1f(au.uLevel, LaAir); gl.uniform1f(au.uLum, V.L.lum);
        gl.uniform1f(au.uLow, rm ? 0 : FEAT.bass); gl.uniform1f(au.uMid, rm ? 0 : FEAT.mid); gl.uniform1f(au.uHigh, rm ? 0 : FEAT.treble);
        gl.uniform1f(au.uDim, clamp(0.45 + 0.55 * V.scale / 700, 0.45, 1)); gl.uniform1fv(au.uChroma, DC); gl.uniform1fv(au.uTint, V.tint); gl.uniform1f(au.uHoleR, HOLE_R);
        gl.bindVertexArray(G.aurVao); gl.drawArrays(gl.POINTS, V.auroraStart, aurN);
      };
      const setDots = function (half) {
        gl.useProgram(G.dots.p);
        gl.uniform2f(u.uView, V.vw, V.vh); gl.uniform2f(u.uCenter, V.cx, V.cy);
        gl.uniform1f(u.uScale, sceneScale); gl.uniform1f(u.uSin, sinI); gl.uniform1f(u.uTilt, roll); gl.uniform1f(u.uPx, V.rs); gl.uniform1f(u.uHalf, half);
        gl.uniform1f(u.uDiskBreath, diskBreath);
        gl.uniform1f(u.uHoleR, HOLE_R);
        gl.uniform1f(u.uPhase, V.phase + V.track * 3.1);
        const revBase = Math.max(Lg * 1.4 - 0.1, 0);
        gl.uniform1f(u.uReveal, lerp(revBase, Math.max(revBase, 1.35), revealForce));   // در تونل همهٔ حلقه‌ها روشن می‌مانند (با رمپِ پیوسته، نه پرش)
        gl.uniform1f(u.uLum, V.L.lum); gl.uniform1f(u.uTime, nowS % 6000);
        gl.uniform1f(u.uPulseR, 0.12 + 0.95 * pp); gl.uniform1f(u.uPulseA, pp < 1 ? V.pulse.amp * Math.pow(1 - pp, 1.5) : 0);
        const baseDim = clamp(0.45 + 0.55 * V.scale / 700, 0.45, 1);
        gl.uniform1f(u.uDim, Math.max(baseDim, tunnelMode ? 0.95 * dive : 0));
        gl.uniform1f(u.uMid, rm ? 0 : FEAT.mid); gl.uniform1f(u.uHigh, rm ? 0 : FEAT.treble); gl.uniform1f(u.uStructure, rm ? 0 : V.structure);
        gl.uniform1f(u.uDive, dive); gl.uniform1f(u.uTravel, V.travel);
        // §B وزنِ دو پاس از splitWeights() خوانده می‌شود؛ dive=0 → همان (۱,۱)ِ همیشگی.
        gl.uniform1f(u.uCull, sw.hard ? -1 : sw.halfW); gl.uniform1f(u.uOccl, sw.hard ? 0 : sw.halfW);
        gl.uniform1fv(u.uChroma, DC); gl.uniform1fv(u.uTint, V.tint); gl.uniform3fv(u.uPal, PAL);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.tex); gl.uniform1i(u.uAur, 0);
        gl.uniform1f(u.uAurMix, LaAir > 0.003 ? clamp(LaAir * 1.5, 0, 1) : 0);
        gl.bindVertexArray(G.dotVao); gl.drawArrays(gl.POINTS, 0, n);
      };
      const drawHorizon = function (holeR, level, flare, energy, bass) {
        const h = G.hor.u;
        gl.useProgram(G.hor.p);
        gl.uniform2f(h.uCanvas, V.W, V.H); gl.uniform1f(h.uPx, V.rs); gl.uniform2f(h.uCenter, V.cx, V.cy);
        gl.uniform1f(h.uScale, sceneScale); gl.uniform1f(h.uHoleR, holeR);
        gl.uniform1f(h.uLevel, level); gl.uniform1f(h.uLum, V.L.lum);
        // §IDLE: energy/bass از بیرون می‌آیند تا همان یک پاس، در حالتِ هاله، با عددِ بی‌دادهٔ صدا
        // پخش شود. بدونِ آن دو آرگومان، دقیقاً همان دو مقدارِ همیشگی (V.energy و FEAT.bass).
        gl.uniform1f(h.uTime, V.haloT); gl.uniform1f(h.uEnergy, energy === undefined ? (V.energy || 0) : energy);
        gl.uniform1f(h.uBass, bass === undefined ? (rm ? 0 : FEAT.bass) : bass); gl.uniform1f(h.uFlare, flare);
        gl.uniform1f(h.uAxis, roll + V.haloT * 0.05); gl.uniform3f(h.uTint, V.tintC[0], V.tintC[1], V.tintC[2]);
        // افق فقط چند شعاع حولِ سیاه‌چاله محتوا دارد؛ scissor همان ناحیه را رسم می‌کند، نه کلِ صفحه.
        const radDev = (holeR * sceneScale * 4.5 + 6) * V.rs;
        const cxd = V.cx * V.rs, cyd = V.H - V.cy * V.rs;
        const x0 = Math.max(0, Math.floor(cxd - radDev)), y0 = Math.max(0, Math.floor(cyd - radDev));
        const x1 = Math.min(V.W, Math.ceil(cxd + radDev)), y1 = Math.min(V.H, Math.ceil(cyd + radDev));
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
        gl.bindVertexArray(G.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disable(gl.SCISSOR_TEST);
      };
      /* §ENCHANT پاسِ هالهٔ افسونگر: یک مثلثِ تمام‌صفحه با scissor دورِ کره (۷R)، جمع‌شونده (ONE,ONE)
         بعد از پاسِ افق؛ بیرونِ کره می‌کشد پس کرهٔ سیاه کدر می‌ماند. enchU=null ⇒ هیچ کاری نمی‌کند. */
      const enchU = enchUniforms(idleW);
      const drawEnch = function () {
        if (!enchU || !G.ench) return;
        const e = G.ench.u;
        gl.useProgram(G.ench.p);
        gl.uniform2f(e.uCanvas, V.W, V.H); gl.uniform1f(e.uPx, V.rs); gl.uniform2f(e.uCenter, V.cx, V.cy);
        gl.uniform1f(e.uScale, sceneScale); gl.uniform1f(e.uHoleR, HOLE_R);
        gl.uniform1f(e.uTime, ENCH.t); gl.uniform1f(e.uFlow, ENCH.flow); gl.uniform1f(e.uAura, enchU.aura); gl.uniform1f(e.uSwell, enchU.swell); gl.uniform1f(e.uSqueeze, enchU.squeeze);
        gl.uniform1f(e.uR1, enchU.r1); gl.uniform1f(e.uA1, enchU.a1); gl.uniform1f(e.uR2, enchU.r2); gl.uniform1f(e.uA2, enchU.a2);
        const radDev = (HOLE_R * sceneScale * 7.0 + 6) * V.rs;
        const cxd = V.cx * V.rs, cyd = V.H - V.cy * V.rs;
        const x0 = Math.max(0, Math.floor(cxd - radDev)), y0 = Math.max(0, Math.floor(cyd - radDev));
        const x1 = Math.min(V.W, Math.ceil(cxd + radDev)), y1 = Math.min(V.H, Math.ceil(cyd + radDev));
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
        gl.bindVertexArray(G.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disable(gl.SCISSOR_TEST);
      };
      /* §IDLE هاله فقط «یک» پاسِ افق است، نه پاسِ دوم: level با همان idleX بینِ کهکشان (Lg) و
         نورِ هاله مخلوط می‌شود، پس در گذار هیچ فریمی دوبار روشن نمی‌شود و هیچ سیاهی‌ای هم
         نمی‌بینیم (Lg=holeRest→0 با هالهٔ 0→level هم‌زمان و روی هم پیوسته). */
      const horLevel = Lg * (1 - idleW) + idleHaloLevel() * idleW;
      const horFlare = V.flare * (1 - idleW);
      const horEnergy = idleW > 0.0005 ? V.haloE : undefined;
      const horBass = idleW > 0.0005 ? (rm ? 0 : FEAT.bass * (1 - idleW)) : undefined;
      if (!sw.hard) {
        if (!tunnelMode) setAurDots(0);                // §B شفق دقیقاً مثلِ امروز: فقط کهکشان
        if (dotsOn) setDots(0);                                 // نیمهٔ دورِ حلقه‌ها (پشتِ کره)
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        drawHorizon(HOLE_R, horLevel, horFlare, horEnergy, horBass);   // کرهٔ کامل (§IDLE: تنها پاسِ افق)
        gl.blendFunc(gl.ONE, gl.ONE);
        drawEnch();                                             // §ENCHANT هالهٔ افسونگر (فقط بیرونِ کره)
        if (!tunnelMode) setAurDots(1);
        if (dotsOn) setDots(1);                                 // نیمهٔ نزدیکِ حلقه‌ها (جلوی کره)
      } else {
        // تک‌پاسِ کاملِ حلقه‌های بی‌نهایت؛ افقِ سیاه کوچک و همیشگی روی مرکز می‌آید (بدونِ سیاهیِ تمام‌صفحه).
        gl.blendFunc(gl.ONE, gl.ONE);
        if (dotsOn) setDots(1);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        drawHorizon(HOLE_R, horLevel, horFlare, horEnergy, horBass);
        gl.blendFunc(gl.ONE, gl.ONE);
        drawEnch();
      }
    }

    if ((V.powder.on || V.entrance.active) && V.powder.n > 0) {
      const w = G.pow.u;
      const entering = V.entrance.active && !V.powder.on;
      const fade = entering ? clamp((V.entrance.duration + V.entrance.handoff - V.entrance.elapsed) / V.entrance.handoff, 0, 1) : 1;
      gl.useProgram(G.pow.p);
      gl.uniform2f(w.uView, V.vw, V.vh); gl.uniform2f(w.uCenter, V.cx, V.cy);
      gl.uniform1f(w.uProg, V.powder.prog); gl.uniform1f(w.uApp, entering ? clamp(V.entrance.elapsed / 0.10, 0, 1) : V.powder.appear);
      gl.uniform1f(w.uSin, sinI); gl.uniform1f(w.uPx, V.rs);
      gl.uniform1f(w.uBoxX, V.powder.box[0]); gl.uniform1f(w.uBoxW, V.powder.box[1]);
      gl.uniform1f(w.uMode, entering ? 1 : 0); gl.uniform1f(w.uEnter, entering ? clamp(V.entrance.elapsed / V.entrance.duration, 0, 1) : 0);
      gl.uniform1f(w.uCoreR, HOLE_R * sceneScale * 1.05); gl.uniform1f(w.uFade, fade); gl.uniform1f(w.uHasStars, V.powder.hasStars ? 1 : 0);
      gl.bindVertexArray(V.powder.vao); gl.drawArrays(gl.POINTS, 0, V.powder.n);
    }
    gl.bindVertexArray(null);
  }

  /* ---------- حلقه ---------- */
  function startLoop() {
    if (V.running || !V.ok) return;
    refreshTaps();
    V.running = true; V.last = performance.now();
    Q.grace = Math.max(Q.grace, performance.now() + 2200);
    Q.fpsEma = 0; Q.msEma = 0; Q.slow = 0; Q.fast = 0;
    V.raf = requestAnimationFrame(frameG);
  }
  function stopLoop(clear) {
    V.running = false;
    if (V.raf) { cancelAnimationFrame(V.raf); V.raf = 0; }
    if (clear && V.ok) { try { V.gl.bindFramebuffer(V.gl.FRAMEBUFFER, null); V.gl.clearColor(0, 0, 0, 0); V.gl.clear(V.gl.COLOR_BUFFER_BIT); } catch (e) {} }
    VM.setPowder(false);
    cancelTitleEntrance(false);
  }
  function frame(now) {
    V.raf = 0;
    if (!V.running) return;
    const rm = reduced();
    // §IDLE هاله «سریع» نیست: با idleX بالا همان fpsِ آرامِ حالتِ سکوت را نگه می‌داریم (کم‌مصرف)
    const fast = !rm && (V.stage === 'galaxy' || V.dive > 0.05 || V.powder.on || V.entrance.active) && !(CFG.idleHalo && V.idleX > 0.5);
    const minDt = 1000 / (rm ? CFG.reducedFps : (fast ? CFG.galaxyFps : Q.calm));
    const dtMs = now - V.last;
    if (dtMs < minDt - 3) { V.raf = requestAnimationFrame(frameG); return; }
    V.last = now;
    const dt = Math.min(dtMs, 100) / 1000, nowS = now / 1000;
    V.time = nowS;
    // پودر: در صورت نیاز یک بار (برای همین آهنگ/اندازه) نمونه‌برداری کن
    if ((V.powder.on || V.entrance.pending) && V.powder.key === '') {
      V.powder.key = 'x'; buildPowder();
      if (V.entrance.pending) {
        if (V.powder.n > 0 && V.playing && VM.isOpen() && !document.hidden && !reduced() && !V.powder.on) { V.entrance.pending = false; V.entrance.active = true; V.entrance.elapsed = 0; VM.setPowder(true); }
        else cancelTitleEntrance(true);
      }
    }
    // تغییر مقیاسِ رندر را قبل از رسمِ همین فریم اعمال کن تا یک فریمِ خالی/سیاه دیده نشود.
    if (Q.scaleDirty) applyRenderScale(now);
    const c0 = performance.now();
    step(dt, nowS);
    if (V.powder.on && V.powder.key === '') { V.powder.key = 'x'; buildPowder(); }
    draw(nowS);
    V.cpuMs += ((performance.now() - c0) - V.cpuMs) * 0.1;
    const pushEvery = Q.tier === 0 ? 8 : 4;
    if ((V.frames & (pushEvery - 1)) === 0) pushVizNow();

    V.frames++; V.fpsT += dt;
    if (V.fpsT >= 1) {
      V.fps = V.frames / V.fpsT; V.frames = 0; V.fpsT = 0;
      updateQuality(now);
    }
    if (V.hudOn) updateHud(now);

    /* §IDLE حالتِ فریزِ پایانیِ idle: یا کهکشان در «ردِ کم‌نورِ همیشگی» (holeRest) نشسته، یا
       هاله کاملاً بیرون رفته و Lg هم به صفر رسیده (صاحبِ صوتی رفت). تا idleAudio روشن است یا
       idleX دارد پایین می‌آید، حلقه نباید بایستد — وگرنه فریمِ هاله روی صفحه «مرده» می‌ماند و
       عنوانِ آن منبع هم روی همان یخ می‌ماند. شرطِ دوم با flag خاموش هرگز فعال نمی‌شود. */
    const settledCalm = V.L.aurora < 0.004 &&
      (Math.abs(V.L.galaxy - CFG.holeRest) < 0.008 || (V.idleX < 0.001 && V.L.galaxy < 0.004));
    /* §SCENE: درِ فریز باید صحنه را هم ببیند، وگرنه در لحظهٔ رفتنِ پخش (idleX هنوز صفر و
       Lg روی holeRest) حلقه می‌ایستد و یک فریمِ مرده جای نفسِ آهستهٔ هاله را می‌گیرد. */
    const sceneOn = sceneWanted();
    if (!V.playing && settledCalm && !(CFG.idleHalo && V.idleAudio) && !sceneOn) {
      stopLoop(false);                                           // آخرین فریم (سیاه‌چاله‌ی کم‌نور) روی صفحه می‌ماند؛ دیگر هیچ پردازشی نیست
      try { const au = VM.getAudio(); if (A.ok && A.ctx.state === 'running' && au && !playSignal(au) && suspendAllowed(au)) A.ctx.suspend(); } catch (e) {}
      if (V.hudOn) updateHud(now);
      return;
    }
    V.raf = requestAnimationFrame(frameG);
  }
  // §0 wrapperهای ثابت (یک بسته در ابتدای ماژول، نه هر فریم): زنجیرهٔ rAF تنها مسیرِ
  // ship‌شده‌ای است که با یک خطا برای همیشه می‌ایستد؛ LOOP-LOST همان را گزارش می‌کند.
  const frameG = guardChain(frame, 'raf:galaxy-frame', function () { return V.raf; }, function () { return V.running; });

  /* ---------- HUD (Shift+D) ---------- */
  // خطِ SHOW صادق است: می‌گوید این حرکت‌ها آرایشی‌اند و هیچ دادهٔ صوتی‌ای پشتشان نیست.
  function hudShowLine() {
    const s = V.show;
    return 'SHOW ' + (CFG.ambientShow ? 'ON' : 'off') + (s.on ? '' : '  (idle: not ambient/playing/visible)') +
      '  phase ' + s.phase + '  t ' + s.t.toFixed(1) + 's  env ' + s.env.toFixed(3) + '  lvl ' + s.level.toFixed(2) +
      '  seed ' + s.seed + '  hue ' + s.hueIdx + '  density ' + showDensity().toFixed(2) +
      '\n  effects: comets ' + s.nComet + '  blooms ' + s.nBloom + '  groupWakes ' + s.nWake +
      '  starFlights ' + s.nFlight + (s.nFlightNoStars ? '/skipped-no-stars ' + s.nFlightNoStars : '') +
      '  surges ' + s.nSurge + (s.nSurgeNoGate ? '/no-gate ' + s.nSurgeNoGate : '') +
      '  maxEnvRate ' + s.maxEnvRate.toFixed(2) + '/s  (decorative — NOT audio analysis)';
  }
  function updateHud(now) {
    if (!V.hud || now - V.hudT < 250) return;
    V.hudT = now;
    let top = 0; for (let i = 1; i < 12; i++) if (A.chroma[i] > A.chroma[top]) top = i;
    V.hud.textContent =
      'stage ' + V.stage + '  t ' + V.stageT.toFixed(1) + 's   fps ' + V.fps.toFixed(0) + '   dots ' + Math.floor(V.N * V.q) + '/' + V.N +
        '   tier ' + Q.tier + '  q ' + V.q.toFixed(2) + '  rs ' + V.rs.toFixed(2) + '  aurora ' + Q.auroraEvery + 'x\n' +
      'ANALYSIS ' + FEAT.quality.toUpperCase() + (FEAT.quality === 'live' ? '' : '  ← no real audio features (decorative/hold)') + '\n' +
      // §IDLE خطِ صادقِ حالتِ «صدا بدونِ موسیقی»: رأیِ لایهٔ منبع + ضامنِ crossfade + چرا
      'IDLE-HALO ' + (CFG.idleHalo ? (V.idleAudio ? 'ON' : 'off') : 'flag-off') + '  x ' + V.idleX.toFixed(2) +
        '  level ' + idleHaloLevel().toFixed(3) + '  reason ' + V.idleWhy + '  taps ' + !!(A.ok && A.tapped) + '\n' +
      // §SCENE خطِ حالتِ نمایش: 'source' هرگز ادعایِ پخشِ تأییدشده نمی‌کند (ANALYSIS خطِ بالا صاحبِ ادعا است)
      'SCENE ' + (CFG.scene ? V.vstate : 'flag-off') + '  src ' + V.srcKind + '  awaken x ' + V.awakenX.toFixed(2) +
        ' → ' + awakenTarget().toFixed(3) + '  reason ' + V.sceneWhy + '\n' +
      'db ' + A.db.toFixed(1) + '  pk/fl ' + A.pk.toFixed(0) + '/' + A.fl.toFixed(0) + '  en ' + A.en.toFixed(2) + '  E ' + A.energy.toFixed(2) + '  flux x' + A.fluxR.toFixed(2) + '  base ' + A.fluxBase.toFixed(3) + '  norm ' + A.bandNorm.toFixed(1) + 'dB\n' +
      'onset ' + (FEAT.onset ? 'HIT ' + FEAT.onsetStrength.toFixed(2) : '-') + '  bassBeat ' + (FEAT.beat ? 'yes' : 'no') + '  bassDom ' + FEAT.bassDom.toFixed(2) + '  energy ' + (V.energy || 0).toFixed(2) + '\n' +
      'conf ' + A.conf.toFixed(2) + '  top ' + NOTE[top] + ' ' + A.chroma[top].toFixed(2) + '  centroid ' + A.centroidR.toFixed(2) + '  bright ' + A.bright.toFixed(2) + '\n' +
      'bands low/mid/high ' + FEAT.bass.toFixed(2) + '/' + FEAT.mid.toFixed(2) + '/' + FEAT.treble.toFixed(2) + '  structure ' + V.structure.toFixed(2) + '\n' +
      'aurora ' + V.L.aurora.toFixed(2) + '  galaxy ' + V.L.galaxy.toFixed(2) + '  dive ' + (V.dive || 0).toFixed(2) + '  travel ' + (V.travel || 0).toFixed(2) + '  powder ' + (V.powder.on ? V.powder.prog.toFixed(2) + '/T' + V.powder.T.toFixed(1) : '-') + '  ctx ' + (A.ok ? A.ctx.state : A.state) + '  thr E ' + CFG.enterE.toFixed(2) + '/' + CFG.exitE.toFixed(2) + '  flux ' + CFG.enterFluxR.toFixed(2) +
      '\n' + hudShowLine();
  }
  function toggleHud() {
    V.hudOn = !V.hudOn;
    if (!V.hud) {
      V.hud = document.createElement('div'); V.hud.className = 'vm-hud';
      const root = VM.getRoot(); if (root) root.appendChild(V.hud);
    }
    V.hud.hidden = !V.hudOn;
    if (V.hudOn) { V.hudT = 0; updateHud(performance.now() + 1000); }
  }
  document.addEventListener('keydown', function (e) {
    if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'D' || e.key === 'd') && VM.isOpen()) { toggleHud(); }
  }, true);

  /* ---------- رویدادهای Music Mode ---------- */
  function newTrackLook(seed) {
    cancelTitleEntrance(true);
    // §3(الف): آهنگِ تازه روایت را از نو شروع نمی‌کند (نه زمانِ سپری‌شده، نه عمقِ سفر)؛
    // تنها زمان‌بندیِ چرخه‌ها با طولِ آهنگِ نو هماهنگ می‌شود. سفر پیوسته ماندگار است.
    Q.upBlockedUntil = 0; Q.lastUpAt = 0; Q.slow = 0; Q.fast = 0;   // با آهنگِ تازه، یک آزمونِ کیفیتِ تازه مجاز است
    Q.fpsEma = 0; Q.msEma = 0; Q.grace = performance.now() + 1500;
    clearTimeout(V.retimeT);
    V.retimeT = setTimeout(guard(function () {
      if (V.playing && VM.isOpen() && !reduced()) {
        if (V.opening.started) retimeOpening(); else startCinematicOpening();
      }
    }, 'to:retime-700ms'), 700);
    const r = mulberry32((seed ^ V.session) >>> 0);
    V.track++;
    V.tiltT = (r() - 0.5) * 0.35;                // ±۱۰° شیبِ دیسک
    V.spiralPhT = r() * TAU;
    V.seed3 = [r(), r(), r()];
    resetTransient();                                             // آهنگِ تازه: فلاکس/باسِ آهنگِ قبل نباید ضربهٔ کاذب بسازد
    V.powder.key = '';
  }
  window.addEventListener('voidmusic:track', function (e) {
    cancelStarFlight();
    // §SHOW عنوانِ گزارش‌شده-only-for-seed: همان آهنگ ⇒ همان seed ⇒ همان پالت/روایت (بی‌تحلیلِ صدا)
    if (e.detail && typeof e.detail.title === 'string') V.show.title = e.detail.title;
    newTrackLook((e.detail && e.detail.seed) || Math.random() * 4294967296);
  });
  window.addEventListener('voidmusic:title-ready', function (e) { startTitleEntrance(e.detail); });


  /* ------------------------------------------------------------------ */
  /* ویژولایزرِ کوچکِ orb شناور (بیرون از Music Mode)                       */
  /* ------------------------------------------------------------------ */
  // فقط وقتی کار می‌کند که: موزیک پخش شود + orb دیده شود + تب پیدا باشد. ~۱۵fps، یک canvasِ ۲Dِ کوچک.
  // همان ۱۲ حلقهٔ کلاسِ نت (هم‌زبان با کهکشانِ اصلی) با دیدِ از بالا؛ کره‌ی سیاه در مرکز.
  const RMV = { chroma: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], energy: 0 };
  function pushVizNow() {
    if (!VM.pushViz) return;
    for (let i = 0; i < 12; i++) RMV.chroma[i] = Math.round(A.chroma[i] * 1000) / 1000;
    RMV.energy = A.energy; VM.pushViz(RMV);
  }
  // وقتی تبِ Void Tab پنهان است rAF نمی‌چرخد؛ اگر تبِ دیگری orb را نشان می‌دهد، با یک setInterval ِسبک (~۶Hz) تحلیل را ادامه می‌دهیم
  let bgT = 0;
  function bgKick() {
    if (bgT) return;
    bgT = setInterval(guard(function () {
      const a = VM.getAudio();
      if (SND.bg !== 'live' || !document.hidden || !playSignal(a)) { clearInterval(bgT); bgT = 0; return; }
      if (!(VM.remoteWanted && VM.remoteWanted())) return;
      if (!A.ok) return;
      try { anCount(true); analyze(0.17, true); pushVizNow(); } catch (e) {}
    }, 'int:bg-kick-170ms'), 170);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (SND.bg === 'live') bgKick(); }
    else { refreshTaps(); Q.grace = performance.now() + 2000; recoverOnReturn(); }
  });
  const MINI = { raf: 0, last: 0, tick: 0, boot: false };
  function miniActive() {
    const a = VM.getAudio();
    return !!(playSignal(a) && !VM.isOpen() && VM.isMiniVisible && VM.isMiniVisible() && !document.hidden && VM.getMiniCanvas && VM.getMiniCanvas());
  }
  const PAL_CSS = [], PAL_CSS_L = [];
  for (let i = 0; i < 12; i++) {
    const r = Math.round(PAL[i * 3] * 255), g = Math.round(PAL[i * 3 + 1] * 255), b = Math.round(PAL[i * 3 + 2] * 255);
    PAL_CSS.push('rgb(' + r + ',' + g + ',' + b + ')'); PAL_CSS_L.push('rgb(' + Math.min(255, r + 60) + ',' + Math.min(255, g + 60) + ',' + Math.min(255, b + 60) + ')');
  }
  const MG = { W: 0, g: null, bg: null, sph: null, conic: null };
  function miniGrad(g, W, c, R) {
    // گرادیان‌ها فقط وقتی اندازه عوض شود ساخته می‌شوند (نه هر فریم)
    MG.W = W; MG.g = g;
    MG.bg = g.createRadialGradient(c, c, 0, c, c, R);
    MG.bg.addColorStop(0, 'rgba(0,0,0,1)'); MG.bg.addColorStop(0.35, 'rgba(2,3,9,0.94)'); MG.bg.addColorStop(1, 'rgba(9,14,28,0.88)');
    const sr = R * 0.22;
    MG.sph = g.createRadialGradient(0, 0, sr * 0.2, 0, 0, sr * 1.25);
    MG.sph.addColorStop(0, 'rgba(0,0,0,1)'); MG.sph.addColorStop(0.8, 'rgba(0,0,0,1)'); MG.sph.addColorStop(0.9, 'rgba(60,44,20,0.55)'); MG.sph.addColorStop(1, 'rgba(0,0,0,0)');
    MG.conic = g.createConicGradient ? g.createConicGradient(0, 0, 0) : null;
    if (MG.conic) {
      MG.conic.addColorStop(0, 'rgba(255,215,150,0.75)'); MG.conic.addColorStop(0.3, 'rgba(255,190,110,0.12)');
      MG.conic.addColorStop(0.62, 'rgba(255,170,100,0.04)'); MG.conic.addColorStop(0.86, 'rgba(255,200,130,0.30)'); MG.conic.addColorStop(1, 'rgba(255,215,150,0.75)');
    }
  }
  function miniDraw(t, live) {
    const cv = VM.getMiniCanvas(); if (!cv) return;
    const g = cv.getContext('2d'); const W = cv.width, c = W / 2, R = c * 0.97;
    if (MG.W !== W || MG.g !== g) miniGrad(g, W, c, R);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, W, W);
    g.save(); g.beginPath(); g.arc(c, c, R, 0, TAU); g.clip();
    g.fillStyle = MG.bg; g.fillRect(0, 0, W, W);
    const ratio = 0.74 + 0.05 * Math.sin(t * 0.09);                 // دیدِ از بالا که آرام تاب می‌خورد
    g.translate(c, c); g.rotate(Math.sin(t * 0.11) * 0.28 + V.tilt);
    const px = W / 64;
    for (let i = 0; i < 12; i++) {
      const e = live && A.ok ? A.chroma[i] : (live ? 0.14 + 0.12 * Math.sin(t * 1.4 + i * 0.9) : 0.08);
      const rx = R * (0.36 + 0.049 * i), ry = rx * ratio;
      g.strokeStyle = PAL_CSS[i]; g.globalAlpha = 0.17 + 0.83 * Math.min(1, e * 1.15);
      g.lineWidth = Math.max(1, px * (0.9 + 1.1 * e));
      g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.stroke();
      if (live && e > 0.32) {                                           // جرقه‌های LED روی حلقه‌های روشن
        g.fillStyle = PAL_CSS_L[i]; g.globalAlpha = 0.95;
        for (let k = 0; k < 3; k++) {
          const ang = (i * 2.399 + MINI.tick * 0.61 + k * 2.09) % TAU;
          g.beginPath(); g.arc(rx * Math.cos(ang), ry * Math.sin(ang), px * 0.95, 0, TAU); g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    const sr = R * 0.22;                                                // کرهٔ سیاه (بدونِ خطِ سفید؛ فقط لبهٔ گرمِ کم‌رنگ)
    g.fillStyle = MG.sph; g.beginPath(); g.arc(0, 0, sr * 1.25, 0, TAU); g.fill();
    if (MG.conic) {                                                     // هالهٔ لبه: لکهٔ نورِ گرمی که آرام دورِ کره می‌چرخد
      g.save(); g.rotate(t * (live ? 0.55 : 0.12)); g.globalAlpha = live ? (0.35 + 0.5 * (V.energy || 0)) : 0.2;
      g.strokeStyle = MG.conic; g.lineWidth = Math.max(1, px * 1.7); g.beginPath(); g.arc(0, 0, sr * 1.04, 0, TAU); g.stroke(); g.restore();
    }
    g.restore();
  }
  function miniFrame(now) {
    MINI.raf = 0;
    if (!miniActive()) { miniDraw(now / 1000, false); return; }
    const dt = (now - MINI.last) / 1000;
    if (dt < 0.062) { MINI.raf = requestAnimationFrame(miniG); return; }     // ≈۱۵fps
    MINI.last = now; MINI.tick++;
    if (A.ok) { try { anCount(true); analyze(Math.min(dt, 0.12), true); } catch (e) {} }
    V.tilt += (V.tiltT - V.tilt) * expK(dt, 2.5);
    miniDraw(now / 1000, true);
    if ((MINI.tick & 3) === 0) pushVizNow();
    MINI.raf = requestAnimationFrame(miniG);
  }
  // §0 همان نگهبانِ زنجیره برای orb کوچک (miniActive=false یعنی توقفِ قانونی، نه مرگِ زنجیره)
  const miniG = guardChain(miniFrame, 'raf:mini-frame', function () { return MINI.raf; }, miniActive);
  async function miniKick() {
    if (MINI.raf) return;
    if (!miniActive()) { if (VM.getMiniCanvas && VM.getMiniCanvas()) miniDraw(performance.now() / 1000, false); return; }
    if (!A.ok && !MINI.boot) { MINI.boot = true; await ensureGraph(); MINI.boot = false; }
    refreshTaps();
    if (A.ok && A.ctx.state !== 'running') { try { await A.ctx.resume(); } catch (e) {} }
    if (MINI.raf || !miniActive()) return;
    A.snap = true; MINI.last = performance.now();
    MINI.raf = requestAnimationFrame(miniG);
  }
  window.addEventListener('voidmusic:mini', function () { miniKick(); setTimeout(guard(refreshTaps, 'to:refreshTaps-50ms'), 50); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) cancelTitleEntrance(true); else miniKick(); refreshTaps(); });

  /* زمان‌بندیِ روایت از طولِ آهنگ ساخته می‌شود، نه از هر رویدادِ رابطِ کاربر. */
  function openingTiming() {
    const audio = VM.getAudio();
    const duration = audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const currentTime = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const trackDur = duration > 0 ? duration : BREATH.fallbackTrackS;
    const remaining = duration > 0 ? Math.max(0, duration - currentTime) : BREATH.fallbackTrackS;
    const titleTail = duration > 0
      ? Math.min(Math.max(CFG.powderMinS, duration / 20 * 1.1), duration * 0.5)
      : CFG.powderMinS;
    const usable = Math.max(24, remaining - (V.entrance.duration + V.entrance.handoff + titleTail));
    const cycleS = clamp(usable / Math.max(2, BREATH.cyclesPerTrack), BREATH.minCycleS, BREATH.maxCycleS);
    // رویدادِ تونل: حدودِ DIVE.trackShare از طولِ آهنگ، و روایتِ گشایش یک‌سومِ نخستین چرخه.
    const eventS = Math.min(clamp(trackDur * DIVE.trackShare, DIVE.minEventS, DIVE.maxEventS), cycleS * 0.50);
    return { cycleS: cycleS, eventS: eventS, openS: clamp(cycleS * 0.34, 6, 40) };
  }
  /* «تب شناسایی شد» با «موسیقی واقعاً پخش می‌شود» یکی نیست (§1 و §4). گشایشِ در به دادهٔ صوتی
     گره می‌خورد: آنالایزرِ زنده، یا نبودِ آنالایزر (ambient)؛ سکوتِ بی‌سیگنال تنها پس از یک
     مهلتِ کوتاه مجاز است، تا آهنگِ واقعاً بی‌صدای کاربر هم سفرش را ببیند. */
  function gateSignalOk() {
    return FEAT.quality === 'live' || FEAT.quality === 'ambient' ||
      (FEAT.quality === 'silent' && V.tPlay > DIVE.silentGraceS);
  }
  /* §3(الف): درِ کرم‌چاله یک‌بار و در آغازِ واقعیِ پخش گشوده می‌شود. «رسیدنِ اطلاعاتِ تب» یا
     «آهنگِ تازه» آن را از نو باز نمی‌کند؛ آن‌ها فقط زمان‌بندیِ چرخه را تازه می‌کنند (retime)،
     پس سفرِ پیوسته (§3(ب)) هیچ‌وقت به نقطهٔ صفر برنمی‌گردد. */
  function startCinematicOpening() {
    if (V.opening.started || reduced() || !V.playing || !VM.isOpen() || document.hidden) return;
    if (!gateSignalOk()) return;
    if (V.opening.cam > 0.02) return;   // دوربین هنوز از سفرِ پیشین بیرون نیامده: گشایشِ نو پرش نمی‌کند، صبر می‌کند
    const T = openingTiming();
    V.opening.cycleS = T.cycleS; V.opening.eventS = T.eventS; V.opening.openS = T.openS;
    V.opening.started = true; V.opening.phase = 'open';
    V.opening.elapsed = 0; V.opening.progress = 0; V.opening.cam = 0;
    V.opening.evAt = -1; V.opening.evLen = 0; V.opening.nextAt = 0;
    V.dive = 0;
    V.breath.pitch = BREATH.startPitch; V.breath.zoom = BREATH.startZoom; V.breath.mix = 1;
  }
  /* آهنگِ تازه در میانهٔ سفر: طولِ نو فقط بازه‌ها را عوض می‌کند؛ فاز، زمانِ سپری‌شده و
     عمقِ فعلی دست‌نخورده می‌مانند (بی‌هیچ پرشِ دوربین). */
  function retimeOpening() {
    const T = openingTiming();
    V.opening.cycleS = T.cycleS; V.opening.eventS = T.eventS;
    // openS همواره «طولِ کلِ گشایش» است، نه زمانِ باقی‌مانده: در میانهٔ گشایش فقط می‌تواند کوتاه شود
    // (کوتاه‌شدنِ ناگهانی پیشرفتِ دوربین را به جلو می‌اندازد؛ بلندشدن آن را به عقب می‌برد و پرش می‌شود)
    if (V.opening.phase === 'open') V.opening.openS = Math.max(V.opening.elapsed + 2, Math.min(T.openS, V.opening.openS));
    if (V.opening.phase !== 'travel') V.opening.nextAt = 0;
  }
  function resetCinematicOpening() {
    V.opening.started = false; V.opening.phase = 'idle';
    V.opening.elapsed = 0; V.opening.progress = 0; V.opening.cycleS = 60;
    V.opening.eventS = 12; V.opening.openS = 12; V.opening.cam = 0; V.opening.evAt = -1; V.opening.evLen = 0; V.opening.nextAt = 0;
    V.breath.mix = 0; V.breath.pitch = Number.isFinite(V.incl) ? V.incl : 50; V.breath.zoom = 1;
    V.dive = 0;
  }
  /* §3(ج): در تنها وقتی بسته می‌شود که پخش *واقعاً* تمام شده یا Music Mode بسته شده است.
     اینجا فقط «بستن» علامت می‌خورد و دوربین در چند ثانیه بیرون می‌آید (پرش ندارد). */
  function closeCinematicOpening() {
    if (!V.opening.started) return;
    V.opening.started = false; V.opening.phase = 'closing'; V.opening.evAt = -1; V.opening.evLen = 0;
  }

  window.addEventListener('voidmusic:playing', async function (e) {
    const reported = !!(e.detail && e.detail.playing);
    const a0 = VM.getAudio();
    // §1.1 + HOTFIX: «مکث»ِ گزارش‌شده می‌تواند از المنتِ اشتباه یا از یک streamِ mute‌شده بیاید؛
    // تا تب پخش می‌کند یا track زنده است، پخش باور می‌شود (سکوت را RMS و A.silent می‌شناسند).
    // با webPlayRule='legacy' این خط دقیقاً همان شرطِ سختِ Phase 1 می‌شود.
    const playing = reported || !!(a0 && a0.__web && playSignal(a0));
    V.playing = playing; V.playReported = reported;
    if (!playing) cancelTitleEntrance(true);
    webWatchGo();                                                   // §HOTFIX(۲) reportِ بیرونی هم «گوش‌به‌زنگ» را با آخرین حالت هم‌وقت کند
    idleHaloCheck();                                                // §IDLE همین report می‌گوید منبعِ تازه موسیقی است یا فقط صدا (بدونِ صبر تا تیکِ ۳ ثانیه)
    if (playing && A.ok && A.ctx.state !== 'running') { try { A.ctx.resume(); } catch (er) {} }
    if (playing) {
      V.tPlay = 0; A.snap = true; P.hiAt = performance.now(); if (!A.ok) A.tries = Math.min(A.tries, 3);   // هر بار پخش (با ژستِ کاربر) دوباره امتحان کن
      if (document.hidden) bgKick();
      // صدا از گرافِ Web Audio می‌گذرد؛ context هیچ‌وقت نباید وقتی موزیک پخش می‌شود معلق بماند
      if (A.ok && A.ctx.state !== 'running') { try { await A.ctx.resume(); } catch (er) {} }
      if (!VM.isOpen()) { miniKick(); return; }       // خارج از Music Mode: فقط صدا + ویژولایزرِ کوچکِ orb
      if (!V.ok && !initGL()) return;
      beginCosmicSession();
      startCinematicOpening();
      await ensureGraph();
      if (!V.playing) return;
      if (A.ok && A.ctx.state !== 'running') { try { await A.ctx.resume(); } catch (er) {} }
      startLoop();
    } else {
      // §3(ج): مکثِ موقت درِ کرم‌چاله را نمی‌بندد (هیچ‌چیز از روایت پاک می‌شود و ادامه می‌یابد)؛
      // پایانِ واقعیِ آهنگ (ended / رسیدن به انتها / نبودِ آهنگِ بارگذاری‌شده) یا خروج از Music Mode آن را می‌بندد.
      const a2 = VM.getAudio();
      const ended = !a2 || a2.ended === true ||
        (Number.isFinite(a2.duration) && a2.duration > 0 && a2.currentTime >= a2.duration - 0.05) ||
        !(VM.getState && VM.getState().current);
      if (ended) closeCinematicOpening();
      if (!VM.isOpen()) {
        miniKick();
        setTimeout(guard(function () { const a = VM.getAudio(); try { if (A.ok && A.ctx.state === 'running' && a && !playSignal(a) && !VM.isOpen() && suspendAllowed(a)) A.ctx.suspend(); } catch (er) {} }, 'to:suspend-check-300ms'), 300);
      }
    }
  });

  window.addEventListener('voidmusic:mode', function (e) {
    if (e.detail && e.detail.open) {
      clearTimeout(V.tdT);
      if (V.ok) { try { resizeGL(); } catch (er) {} }                 // اگر context هنوز زنده است، همان را به‌کار ببر (ورودِ فوری، بدونِ کامپایلِ دوبارهٔ شیدرها)
      // برگشت به Music Mode وقتی موزیک همچنان پخش می‌شود → نمایش دوباره شروع شود
      const a = VM.getAudio();
      if (playSignal(a)) {
        // خطِ پایهٔ بلندی را نگه می‌داریم (قبلاً دوباره «همین‌الان» را پایه می‌گرفت و در بخشِ پرصدا هیچ‌وقت اوجی دیده نمی‌شد)
        V.playing = true; V.tPlay = 0; A.warm = 0;
        if (V.lastStage === 'galaxy') { V.stage = 'galaxy'; V.stageT = 0; V.loT = 0; V.hiT = 0; }
        if (V.ok || initGL()) {
          beginCosmicSession();
          startCinematicOpening();
          ensureGraph().then(function () { if (V.playing && VM.isOpen()) startLoop(); });
        }
      } else if (VM.getState && VM.getState().current) {
        // آهنگ بارگذاری شده ولی در مکث: ردِ کم‌نورِ سیاه‌چاله همچنان در صحنه باشد
        if (V.ok || initGL()) {
          /* §SCENE «مکث با آهنگ بارگذاری‌شده» = منبعِ فعالِ بی‌پخش ⇒ دیسکِ موجود روی همان
             هدفِ بیداری می‌نشیند و ضامن هم جفت می‌شود، وگرنه حلقهٔ تازه Lg را از 0.34 به
             holeRest می‌کشید و بعد بالا می‌آورد (فرورفتگیِ یک‌فریمه). با scene خاموش عیناً
             رفتارِ قبلی: یک فریمِ holeRest، بدونِ دست‌زدنِ به مخلوط‌ها. */
          let awake = false;
          if (CFG.scene) { scenePoll(); V.vstate = visualState(); awake = V.vstate === 'source'; }
          if (awake) { V.awakenX = 1; V.idleX = 0; }
          V.L.galaxy = awake ? awakenTarget() : CFG.holeRest; V.L.aurora = 0;
          try { draw(performance.now() / 1000); } catch (er) {}
        }
      }
      idleHaloCheck();   // §IDLE ورود به Music Mode با منبعِ صوتیِ بی‌موسیقی: هاله منتظرِ تیکِ ۳ ثانیه نمی‌ماند
      return;
    }
    cancelTitleEntrance(true);
    resetCosmicNarrative();
    V.lastStage = V.stage;
    V.playing = false; stopLoop(true);
    resetCinematicOpening();
    clearTimeout(V.tdT); V.tdT = setTimeout(guard(function () { if (!VM.isOpen()) { teardownGL(); V.dead = false; } }, 'to:teardown-30s'), 30000);   // ۳۰ ثانیه نگه می‌داریم؛ بعد آزاد می‌شود
    V.dead = false; V.L.aurora = 0; V.L.galaxy = 0; V.stage = 'calm';
    // اگر موزیک هنوز پخش می‌شود، context را معلق نکن (صدا قطع می‌شود)
    try { const a = VM.getAudio(); if (A.ok && A.ctx.state === 'running' && a && !playSignal(a) && suspendAllowed(a)) A.ctx.suspend(); } catch (er) {}
    if (V.hud) { V.hud.hidden = true; V.hudOn = false; }
    /* §0.۱ miniKick async است: خطایش rejection است و try/catchِ نگهبان آن را نمی‌بیند، پس
       با attach برچسبِ همین تایمر را می‌گیرد (از دست رفتنِ برچسب = «کدام تایمر پرتاب کرد؟» بی‌جواب). */
    setTimeout(guard(function () { attach('to:post-close-80ms', miniKick()); refreshTaps(); }, 'to:post-close-80ms'), 80);
  });

  V.tdT = 0;
  let rzT = 0;
  window.addEventListener('resize', function () {
    V.grace = performance.now() + 3500;                          // گذارِ تمام‌صفحه/تغییر اندازه فریم‌ها را موقتاً می‌اندازد؛ کیفیت را پایین نیاور
    clearTimeout(rzT); rzT = setTimeout(guard(function () { if (V.ok) { resizeGL(); if (!V.running && V.playing) startLoop(); else if (!V.running) { try { draw(performance.now() / 1000); } catch (e) {} } } }, 'to:resize-120ms'), 120);
  });
  document.addEventListener('fullscreenchange', function () { V.grace = performance.now() + 3500; });

  window.VoidMusicViz = {
    debug: toggleHud,
    // §ENCHANT پیش‌نمایشِ دستی از کنسول (بدونِ پخش): window.VoidMusicViz.previewEntrance()
    // (موجِ شوکِ ورود روی هاله؛ افکت‌های کهکشان فقط در پخشِ واقعی اجرا می‌شوند)
    previewEntrance: function () {
      if (!CFG.enchant || !VM.isOpen()) return false;
      if (!V.ok && !initGL()) return false;
      ENCH.why = 'preview'; const I = ENCH.intro; I.on = true; I.t = 0; I.fired = true;
      if (!V.running) startLoop();
      return true;
    },
    enchantState: function () { return { starts: ENCH.starts, why: ENCH.why, introOn: ENCH.intro.on, introT: Math.round(ENCH.intro.t * 100) / 100, idleX: Math.round(V.idleX * 100) / 100, shader: !!(G && G.ench) }; },
    getStage: function () { return V.stage; },
    debugState: function () {
      const a = VM.getAudio();
      return { playing: V.playing, running: V.running, ok: V.ok, stage: V.stage, frames: V.frames, fps: V.fps,
        elapsed: V.opening.elapsed, progress: V.opening.progress, dive: V.dive, started: V.opening.started,
        aok: A.ok, actx: A.ok ? A.ctx.state : A.state, audioPaused: a ? !!a.paused : null, signal: playSignal(a), web: webApi.diagnostics(),
        analysis: FEAT.quality, energy: FEAT.energy, onset: FEAT.onset,
        audioTime: a && isFinite(a.currentTime) ? a.currentTime : null, audioDur: a && isFinite(a.duration) ? a.duration : null };
    },
    getMetrics: function () {
      return { stage: V.stage, db: A.db, base: A.base, delta: A.db - A.base, fluxR: A.fluxR, energy: V.energy || 0, audioBands: { low: FEAT.bass, mid: FEAT.mid, high: FEAT.treble }, structure: V.structure,
        analysis: { quality: FEAT.quality, onset: FEAT.onset, onsetStrength: FEAT.onsetStrength, beat: FEAT.beat, bassDom: FEAT.bassDom, bandNorm: A.bandNorm, fluxBase: A.fluxBase },
        breath: { disk: V.breath.disk || 0, zoom: V.breath.zoom, pitch: V.breath.pitch, mix: V.breath.mix },
        dive: V.dive || 0, travel: V.travel || 0, opening: { progress: V.opening.progress, cycleS: V.opening.cycleS, eventS: V.opening.eventS, evLen: V.opening.evLen, openS: V.opening.openS, started: V.opening.started, phase: V.opening.phase, elapsed: V.opening.elapsed, evAt: V.opening.evAt, nextAt: V.opening.nextAt }, conf: A.conf, centroidR: A.centroidR,
        q: V.q, chroma: Array.prototype.slice.call(A.chroma), L: { aurora: V.L.aurora, galaxy: V.L.galaxy }, powder: { on: V.powder.on, prog: V.powder.prog, n: V.powder.n, T: V.powder.T || 0 },
        quality: { tier: Q.tier, q: V.q, rs: V.rs, budget: Q.budget, auroraEvery: Q.auroraEvery, band: Q.band, calm: Q.calm },
        ctx: A.ok ? A.ctx.state : A.state, fps: V.fps, cpuMs: V.cpuMs, ok: V.ok, N: V.N };
    },
    // ویژگی‌های تحلیل‌شده دقیقاً همان‌طور که رندر می‌خواند؛ quality صادقانه می‌گوید دادهٔ واقعی است یا نه
    features: function () { return { quality: FEAT.quality, live: FEAT.live, bass: FEAT.bass, mid: FEAT.mid, treble: FEAT.treble, bassDom: FEAT.bassDom, energy: FEAT.energy, fluxR: FEAT.fluxR, onset: FEAT.onset, onsetStrength: FEAT.onsetStrength, beat: FEAT.beat, conf: FEAT.conf, silent: FEAT.silent, db: FEAT.db }; },
    config: CFG,
    story: DIVE,
    sound: soundApi,
    web: webApi,
    _test: { A: A, V: V, FEAT: FEAT, CFG: CFG, BAND_AGC_TARGET: BAND_AGC_TARGET, step: step, analyze: analyze, updateFeatures: updateFeatures, resetTransient: resetTransient, swapSource: swapSource, ensureGraph: ensureGraph, buildGeometry: buildGeometry, splitWeights: splitWeights,
      playSignal: playSignal, tapsSignal: tapsSignal, syncPlay: syncPlay, probeIdle: probeIdle, refreshTaps: refreshTaps, streamInfo: streamInfo, suspendAllowed: suspendAllowed, webWatchNeeded: webWatchNeeded, webWatch: WW, errors: function () { return ERR.ring.slice(); },
      // §AMBIENT لایه‌ها از همین‌جا در آزمونِ جعبه‌سیاه خوانده می‌شوند (بی‌نیازی به GPU)
      tierEval: tierEval, tierUpdate: tierUpdate, displayEnergy: displayEnergy, ambientEnergy: ambientEnergy,
      // §SHOW کارگردانِ ambient: تابع‌های خالصِ زمان/seed + وضعیتِ نمایش (بی‌نیازی از GPU و از DOM)
      SHOW: SHOW, hash32: hash32, showWanted: showWanted, showOwnsDisplay: showOwnsDisplay,
      showBegin: showBegin, showUpdate: showUpdate, showEnergy: showEnergy, displayChroma: displayChroma, showDensity: showDensity,
      webReportAgeMs: webReportAgeMs, siteReportedPlayingFresh: siteReportedPlayingFresh,
      // §IDLE حالتِ «صدا بدونِ موسیقی»: رأیِ خالصِ لایهٔ منبع + نورِ هاله (بی‌نیازی از GPU)
      idleAudioEval: idleAudioEval, idleHaloLevel: idleHaloLevel, idleHaloEnergy: idleHaloEnergy, idleHaloCheck: idleHaloCheck,
      // §SCENE رأیِ منبع + حالتِ مشتق + هدفِ بیداری + دروازهٔ فریز/تک‌فریمِ بی‌حرکت (همه بی‌GPU)
      scenePoll: scenePoll, visualState: visualState, awakenTarget: awakenTarget, sceneWanted: sceneWanted,
      paintSceneStill: paintSceneStill, dormantOn: dormantOn, dormantTarget: dormantTarget,
      // §ENCHANT هالهٔ افسونگر / ورودِ باشکوه (بی‌نیازی از GPU)
      ENCH: ENCH, enchStep: enchStep, enchEnvelope: enchEnvelope, enchUniforms: enchUniforms,
      opening: { start: startCinematicOpening, retime: retimeOpening, close: closeCinematicOpening, reset: resetCinematicOpening, signalOk: gateSignalOk, timing: openingTiming } }
  };
})();
