document.addEventListener('DOMContentLoaded', () => {

const i18nPopup = {
      en: {
        tabCore: "⚙️ Core", tabBackup: "🛡️ Backup", tabVault: "✨ Vault",
        lblLanguage: "App Language:", lblBirth: "Family ages",
        btnSave: "Save Settings", btnExport: "📤 Export Backup (JSON)", btnImport: "📥 Import Backup (Restore)",
        toastSaved: "Settings saved successfully!", toastExported: "JSON file downloaded!", toastImported: "Data imported successfully!", toastRestored: "Data restored successfully!",
        invalidFile: "Invalid file format.", errRead: "Error reading JSON file.",
        btnHide: "Hide", btnShow: "Show (Reset)",
        backupHint: "🟢 Export saves everything — bookmarks, todos, calendar, settings, notepad, family ages, frequent links &nbsp;·&nbsp; 🟠 Import restores it all from a file",
        contactTitle: "✉︎ Contact Us", contactEmail: "Email:",
        holidaysTitle: "Official Public Holidays", holidaysEnable: "Show official holidays on the calendar",
        holidayAuto: "Auto — follow app language", holidayIran: "Iran (offline, curated list)", holidayCustom: "Other country (enter code)",
        holidayHintAuto: "Currently resolves to Iran when the app language is Persian, Russia when Russian, Turkey when Turkish, China when Chinese (Simplified), Taiwan when Chinese (Traditional), Brazil when Portuguese (Brazil) — otherwise a country guessed from your system locale.",
        holidayHintIran: "Uses the built-in offline Iran holiday list — no network request needed.",
        holidayHintCustom: "Enter a 2-letter country code (ISO 3166-1, e.g. US, DE, GB, FR). Fetched from a public international holiday source.",
        quotesTitle: "Daily Wisdom Quotes", religionSource: "Spiritual verse source", poetrySource: "Poetry & literature source",
        religionIslam: "☪️ Islam", religionJudaism: "✡️ Judaism", religionChristianity: "✝️ Christianity", religionEastern: "☸️ Eastern (Buddhism & Hindu wisdom)",
        poetryRumi: "🌙 Rumi", poetryWestern: "🖋️ Western Literature",
        vaultLiveSaved: "✓ Saved instantly — no need to press Save",
        lblCreateVoidTab: "Void Galaxy",
        lblRestoreHome: "Home",
        restoreHomeHint: "Go to chrome://settings/onStartup and choose \"Open the New Tab page\" to restore the default.",
        lblCopyVoidHome: "Copy Link",
        lblNtpMode: "New Tab Behavior",
        lblUseDefaultNtp: "Redirect to standard Search Engine on New Tab instead",
        toastNtpDefaultOn: "Standard New Tab enabled",
        toastNtpDefaultOff: "Void Galaxy New Tab restored",
        voidHomeCopiedHint: "✅ Copied! Paste it in Chrome Settings → On startup → Open a specific page"
      },
      fa: {
        tabCore: "⚙️ هسته", tabBackup: "🛡️ پشتیبان", tabVault: "✨ گنجینه",
        lblLanguage: "زبان افزونه:", lblBirth: "عمرشمار خانواده",
        btnSave: "ذخیره تنظیمات", btnExport: "📤 دریافت بکاپ (JSON)", btnImport: "📥 بازیابی از بکاپ",
        toastSaved: "تنظیمات با موفقیت ذخیره شد!", toastExported: "فایل خروجی دانلود شد!", toastImported: "اطلاعات فایل با موفقیت وارد شد!", toastRestored: "بکاپ با موفقیت بازیابی شد!",
        invalidFile: "فایل نامعتبر است.", errRead: "خطا در خواندن فایل JSON.",
        btnHide: "پنهان کردن", btnShow: "نمایش مجدد (ریست)",
        backupHint: "🟢 دریافت بکاپ، همه‌چیز را ذخیره می‌کند — بوک‌مارک‌ها، کارها، تقویم، تنظیمات، دفترچه، عمرشمار خانواده، لینک‌های پرکاربرد &nbsp;·&nbsp; 🟠 بازیابی، همه را از فایل برمی‌گرداند",
        contactTitle: "✉︎ ارتباط با ما", contactEmail: "ایمیل:",
        holidaysTitle: "تعطیلات رسمی", holidaysEnable: "نمایش تعطیلات رسمی روی تقویم",
        holidayAuto: "خودکار — بر اساس زبان افزونه", holidayIran: "ایران (آفلاین، فهرست دقیق)", holidayCustom: "کشور دیگر (کد را وارد کنید)",
        holidayHintAuto: "با انتخاب زبان فارسی روی ایران، روسی روی روسیه، ترکی روی ترکیه، چینی ساده روی چین، چینی سنتی روی تایوان، و پرتغالی برزیل روی برزیل تنظیم می‌شود؛ در غیر این صورت بر اساس حدس از تنظیمات سیستم عمل می‌کند.",
        holidayHintIran: "از فهرست آفلاین داخلیِ تعطیلات ایران استفاده می‌کند — بدون نیاز به اینترنت.",
        holidayHintCustom: "کد دو حرفی کشور را وارد کنید (مثل US، DE، GB، FR). از یک منبع بین‌المللیِ تعطیلات دریافت می‌شود.",
        quotesTitle: "فرازهای الهام‌بخش روزانه", religionSource: "منبع فراز مذهبی", poetrySource: "منبع شعر و ادبیات",
        religionIslam: "☪️ اسلام", religionJudaism: "✡️ یهودیت", religionChristianity: "✝️ مسیحیت", religionEastern: "☸️ شرقی (حکمت بودایی و هندو)",
        poetryRumi: "🌙 مولانا", poetryWestern: "🖋️ ادبیات غرب",
        vaultLiveSaved: "✓ همین الان ذخیره شد — نیازی به زدن «ذخیره تنظیمات» نیست",
        lblCreateVoidTab: "Void Galaxy",
        lblRestoreHome: "خانه",
        restoreHomeHint: "به chrome://settings/onStartup برو و «باز کردن صفحهٔ تب جدید» رو انتخاب کن تا به حالت پیش‌فرض برگرده.",
        lblCopyVoidHome: "کپی لینک",
        lblNtpMode: "رفتار تب جدید",
        lblUseDefaultNtp: "به‌جاش موتور جستجوی استاندارد در تب جدید باز شود",
        toastNtpDefaultOn: "تب جدیدِ استاندارد فعال شد",
        toastNtpDefaultOff: "تب جدیدِ Void Galaxy برگشت",
        voidHomeCopiedHint: "✅ کپی شد! توی تنظیمات کروم ← هنگام شروع ← باز کردن صفحهٔ خاص، پیستش کن"
      },
      ar: {
        tabCore: "⚙️ النواة", tabBackup: "🛡️ النسخ الاحتياطي", tabVault: "✨ الخزنة",
        lblLanguage: "لغة الإضافة:", lblBirth: "أعمار العائلة",
        btnSave: "حفظ الإعدادات", btnExport: "📤 تصدير نسخة احتياطية (JSON)", btnImport: "📥 استيراد نسخة احتياطية (استعادة)",
        toastSaved: "تم حفظ الإعدادات بنجاح!", toastExported: "تم تنزيل ملف JSON!", toastImported: "تم استيراد البيانات بنجاح!", toastRestored: "تمت استعادة البيانات بنجاح!",
        invalidFile: "تنسيق الملف غير صالح.", errRead: "خطأ في قراءة ملف JSON.",
        btnHide: "إخفاء", btnShow: "إظهار (إعادة تعيين)",
        backupHint: "🟢 التصدير يحفظ كل شيء — العلامات المرجعية، المهام، أحداث التقويم، الإعدادات، المفكرة، الروابط الشائعة &nbsp;·&nbsp; 🟠 الاستيراد يستعيد كل شيء من ملف",
        contactTitle: "✉︎ اتصل بنا", contactEmail: "البريد الإلكتروني:",
        holidaysTitle: "العطلات الرسمية", holidaysEnable: "إظهار العطلات الرسمية على التقويم",
        holidayAuto: "تلقائي — حسب لغة التطبيق", holidayIran: "إيران (بدون إنترنت، قائمة دقيقة)", holidayCustom: "دولة أخرى (أدخل الرمز)",
        holidayHintAuto: "يستخدم إيران حاليًا عندما تكون لغة التطبيق فارسية، وروسيا عند الروسية، وتركيا عند التركية، والصين عند الصينية المبسطة، وتايوان عند الصينية التقليدية، والبرازيل عند البرتغالية (البرازيل) — وإلا يتم تقدير الدولة بناءً على إعدادات النظام.",
        holidayHintIran: "يستخدم القائمة المدمجة للعطلات الإيرانية بدون إنترنت — لا يحتاج لاتصال.",
        holidayHintCustom: "أدخل رمز الدولة المكون من حرفين (ISO 3166-1، مثل US، DE، GB، FR). يتم جلبه من مصدر دولي عام للعطلات.",
        quotesTitle: "اقتباسات الحكمة اليومية", religionSource: "مصدر الآيات الروحانية", poetrySource: "مصدر الشعر والأدب",
        religionIslam: "☪️ الإسلام", religionJudaism: "✡️ اليهودية", religionChristianity: "✝️ المسيحية", religionEastern: "☸️ الشرق (الحكمة البوذية والهندوسية)",
        poetryRumi: "🌙 جلال الدين الرومي", poetryWestern: "🖋️ الأدب الغربي",
        vaultLiveSaved: "✓ تم الحفظ فوراً — لا حاجة للضغط على «حفظ الإعدادات»",
        lblCreateVoidTab: "Void Galaxy",
        lblRestoreHome: "الرئيسية",
        restoreHomeHint: "اذهب إلى chrome://settings/onStartup واختر \"فتح صفحة التبويب الجديد\" لاستعادة الوضع الافتراضي.",
        lblCopyVoidHome: "نسخ الرابط",
        lblNtpMode: "سلوك علامة التبويب الجديدة",
        lblUseDefaultNtp: "إعادة التوجيه إلى محرك البحث القياسي بدلاً من ذلك",
        toastNtpDefaultOn: "تم تفعيل علامة التبويب الجديدة القياسية",
        toastNtpDefaultOff: "تمت استعادة علامة التبويب الجديدة الخاصة بـ Void Galaxy",
        voidHomeCopiedHint: "✅ تم النسخ! الصقه في إعدادات كروم ← عند بدء التشغيل ← فتح صفحة معينة"
      },
      es: {
        tabCore: "⚙️ Principal", tabBackup: "🛡️ Respaldo", tabVault: "✨ Bóveda",
        lblLanguage: "Idioma de la app:", lblBirth: "Edades de la familia",
        btnSave: "Guardar ajustes", btnExport: "📤 Exportar respaldo (JSON)", btnImport: "📥 Importar respaldo (Restaurar)",
        toastSaved: "¡Ajustes guardados correctamente!", toastExported: "¡Archivo JSON descargado!", toastImported: "¡Datos importados correctamente!", toastRestored: "¡Datos restaurados correctamente!",
        invalidFile: "Formato de archivo no válido.", errRead: "Error al leer el archivo JSON.",
        btnHide: "Ocultar", btnShow: "Mostrar (Restablecer)",
        backupHint: "🟢 Exportar guarda todo — marcadores, tareas, eventos y días marcados del calendario, ajustes, notas, enlaces frecuentes &nbsp;·&nbsp; 🟠 Importar restaura todo desde un archivo",
        contactTitle: "✉︎ Contáctanos", contactEmail: "Correo:",
        holidaysTitle: "Días festivos oficiales", holidaysEnable: "Mostrar días festivos oficiales en el calendario",
        holidayAuto: "Automático — según el idioma de la app", holidayIran: "Irán (sin conexión, lista curada)", holidayCustom: "Otro país (ingresa el código)",
        holidayHintAuto: "Actualmente usa Irán cuando el idioma es persa, Rusia cuando es ruso, Turquía cuando es turco, China cuando es chino simplificado, Taiwán cuando es chino tradicional, Brasil cuando es portugués (Brasil); en caso contrario, un país estimado según la configuración regional del sistema.",
        holidayHintIran: "Usa la lista interna sin conexión de días festivos de Irán — no requiere red.",
        holidayHintCustom: "Ingresa un código de país de 2 letras (ISO 3166-1, p. ej. US, DE, GB, FR). Se obtiene de una fuente pública internacional de días festivos.",
        quotesTitle: "Citas de sabiduría diaria", religionSource: "Fuente del versículo espiritual", poetrySource: "Fuente de poesía y literatura",
        religionIslam: "☪️ Islam", religionJudaism: "✡️ Judaísmo", religionChristianity: "✝️ Cristianismo", religionEastern: "☸️ Oriental (sabiduría budista e hindú)",
        poetryRumi: "🌙 Rumi", poetryWestern: "🖋️ Literatura occidental",
        vaultLiveSaved: "✓ Guardado al instante — no hace falta pulsar «Guardar»",
        lblCreateVoidTab: "Void Galaxy",
        lblRestoreHome: "Inicio",
        restoreHomeHint: "Ve a chrome://settings/onStartup y elige \"Abrir la página Nueva pestaña\" para restaurar el valor predeterminado.",
        lblCopyVoidHome: "Copiar enlace",
        lblNtpMode: "Comportamiento de Nueva Pestaña",
        lblUseDefaultNtp: "Redirigir al motor de búsqueda estándar en su lugar",
        toastNtpDefaultOn: "Nueva pestaña estándar activada",
        toastNtpDefaultOff: "Nueva pestaña de Void Galaxy restaurada",
        voidHomeCopiedHint: "✅ ¡Copiado! Pégalo en Configuración de Chrome → Al iniciar → Abrir una página específica"
      },
      de: {
        tabCore: "⚙️ Allgemein", tabBackup: "🛡️ Sicherung", tabVault: "✨ Schatzkammer",
        lblLanguage: "App-Sprache:", lblBirth: "Familienalter",
        btnSave: "Einstellungen speichern", btnExport: "📤 Sicherung exportieren (JSON)", btnImport: "📥 Sicherung importieren (Wiederherstellen)",
        toastSaved: "Einstellungen erfolgreich gespeichert!", toastExported: "JSON-Datei heruntergeladen!", toastImported: "Daten erfolgreich importiert!", toastRestored: "Daten erfolgreich wiederhergestellt!",
        invalidFile: "Ungültiges Dateiformat.", errRead: "Fehler beim Lesen der JSON-Datei.",
        btnHide: "Ausblenden", btnShow: "Anzeigen (Zurücksetzen)",
        backupHint: "🟢 Export sichert alles — Lesezeichen, Aufgaben, Kalendertermine & -markierungen, Einstellungen, Notizen, häufig genutzte Links &nbsp;·&nbsp; 🟠 Import stellt alles aus einer Datei wieder her",
        contactTitle: "✉︎ Kontakt", contactEmail: "E-Mail:",
        holidaysTitle: "Offizielle Feiertage", holidaysEnable: "Offizielle Feiertage im Kalender anzeigen",
        holidayAuto: "Automatisch — nach App-Sprache", holidayIran: "Iran (offline, kuratierte Liste)", holidayCustom: "Anderes Land (Code eingeben)",
        holidayHintAuto: "Verwendet derzeit den Iran, wenn die App-Sprache Persisch ist, Russland bei Russisch, die Türkei bei Türkisch, China bei vereinfachtem Chinesisch, Taiwan bei traditionellem Chinesisch, Brasilien bei brasilianischem Portugiesisch — sonst ein anhand der Systemregion geschätztes Land.",
        holidayHintIran: "Verwendet die integrierte Offline-Liste der iranischen Feiertage — keine Internetverbindung nötig.",
        holidayHintCustom: "Gib einen zweibuchstabigen Ländercode ein (ISO 3166-1, z. B. US, DE, GB, FR). Wird aus einer öffentlichen internationalen Feiertagsquelle abgerufen.",
        quotesTitle: "Tägliche Weisheitszitate", religionSource: "Quelle des spirituellen Verses", poetrySource: "Quelle für Poesie & Literatur",
        religionIslam: "☪️ Islam", religionJudaism: "✡️ Judentum", religionChristianity: "✝️ Christentum", religionEastern: "☸️ Östlich (buddhistische & hinduistische Weisheit)",
        poetryRumi: "🌙 Rumi", poetryWestern: "🖋️ Westliche Literatur",
        vaultLiveSaved: "✓ Sofort gespeichert — kein Klick auf „Speichern” nötig",
        lblCreateVoidTab: "Void Galaxy",
        lblRestoreHome: "Start",
        restoreHomeHint: "Gehe zu chrome://settings/onStartup und wähle \"Neue-Tab-Seite öffnen\", um den Standard wiederherzustellen.",
        lblCopyVoidHome: "Link kopieren",
        lblNtpMode: "Verhalten neuer Tabs",
        lblUseDefaultNtp: "Stattdessen zur Standardsuchmaschine weiterleiten",
        toastNtpDefaultOn: "Standard-Neuer-Tab aktiviert",
        toastNtpDefaultOff: "Void Galaxy Neuer Tab wiederhergestellt",
        voidHomeCopiedHint: "✅ Kopiert! In Chrome-Einstellungen → Beim Start → Bestimmte Seite öffnen einfügen"
      },
      fr: {
        tabCore: "⚙️ Général", tabBackup: "🛡️ Sauvegarde", tabVault: "✨ Coffre",
        lblLanguage: "Langue de l'application :", lblBirth: "Âges de la famille",
        btnSave: "Enregistrer les paramètres", btnExport: "📤 Exporter la sauvegarde (JSON)", btnImport: "📥 Importer une sauvegarde (Restaurer)",
        toastSaved: "Paramètres enregistrés avec succès !", toastExported: "Fichier JSON téléchargé !", toastImported: "Données importées avec succès !", toastRestored: "Données restaurées avec succès !",
        invalidFile: "Format de fichier invalide.", errRead: "Erreur lors de la lecture du fichier JSON.",
        btnHide: "Masquer", btnShow: "Afficher (Réinitialiser)",
        backupHint: "🟢 L'export sauvegarde tout — favoris, tâches, événements et jours marqués du calendrier, paramètres, notes, liens fréquents &nbsp;·&nbsp; 🟠 L'import restaure tout depuis un fichier",
        contactTitle: "✉︎ Nous contacter", contactEmail: "E-mail :",
        holidaysTitle: "Jours fériés officiels", holidaysEnable: "Afficher les jours fériés officiels sur le calendrier",
        holidayAuto: "Automatique — selon la langue de l'application", holidayIran: "Iran (hors ligne, liste sélectionnée)", holidayCustom: "Autre pays (saisir le code)",
        holidayHintAuto: "Utilise actuellement l'Iran lorsque la langue est le persan, la Russie pour le russe, la Turquie pour le turc, la Chine pour le chinois simplifié, Taïwan pour le chinois traditionnel, le Brésil pour le portugais (Brésil) — sinon un pays estimé d'après les paramètres régionaux du système.",
        holidayHintIran: "Utilise la liste hors ligne intégrée des jours fériés iraniens — aucune connexion requise.",
        holidayHintCustom: "Saisissez un code pays à 2 lettres (ISO 3166-1, p. ex. US, DE, GB, FR). Récupéré depuis une source internationale publique de jours fériés.",
        quotesTitle: "Citations de sagesse quotidiennes", religionSource: "Source du verset spirituel", poetrySource: "Source de poésie et littérature",
        religionIslam: "☪️ Islam", religionJudaism: "✡️ Judaïsme", religionChristianity: "✝️ Christianisme", religionEastern: "☸️ Orientale (sagesse bouddhiste et hindoue)",
        poetryRumi: "🌙 Rûmî", poetryWestern: "🖋️ Littérature occidentale",
        vaultLiveSaved: "✓ Enregistré instantanément — pas besoin de cliquer sur « Enregistrer »",
        lblCreateVoidTab: "Void Galaxy",
        lblRestoreHome: "Accueil",
        restoreHomeHint: "Allez sur chrome://settings/onStartup et choisissez \"Ouvrir la page Nouvel onglet\" pour restaurer le défaut.",
        lblCopyVoidHome: "Copier le lien",
        lblNtpMode: "Comportement du nouvel onglet",
        lblUseDefaultNtp: "Rediriger vers le moteur de recherche standard à la place",
        toastNtpDefaultOn: "Nouvel onglet standard activé",
        toastNtpDefaultOff: "Nouvel onglet Void Galaxy restauré",
        voidHomeCopiedHint: "✅ Copié ! Collez-le dans Paramètres Chrome → Au démarrage → Ouvrir une page spécifique"
      },
      ja: {
        tabCore: "⚙️ 全般", tabBackup: "🛡️ バックアップ", tabVault: "✨ ヴォールト",
        lblLanguage: "アプリの言語:", lblBirth: "家族の年齢",
        btnSave: "設定を保存", btnExport: "📤 バックアップを書き出す（JSON）", btnImport: "📥 バックアップを読み込む（復元）",
        toastSaved: "設定を保存しました！", toastExported: "JSONファイルをダウンロードしました！", toastImported: "データを読み込みました！", toastRestored: "データを復元しました！",
        invalidFile: "無効なファイル形式です。", errRead: "JSONファイルの読み込みに失敗しました。",
        btnHide: "非表示", btnShow: "表示する（リセット）",
        backupHint: "🟢 書き出しはすべて保存します — ブックマーク、タスク、カレンダーの予定と記念日、設定、メモ、よく使うリンク &nbsp;·&nbsp; 🟠 読み込みはファイルからすべて復元します",
        contactTitle: "✉︎ お問い合わせ", contactEmail: "メール:",
        holidaysTitle: "公式の祝日", holidaysEnable: "カレンダーに公式の祝日を表示",
        holidayAuto: "自動 — アプリの言語に従う", holidayIran: "イラン（オフライン、精選リスト）", holidayCustom: "他の国（コードを入力）",
        holidayHintAuto: "アプリの言語がペルシャ語の場合はイラン、ロシア語ならロシア、トルコ語ならトルコ、簡体字中国語なら中国、繁体字中国語なら台湾、ポルトガル語（ブラジル）ならブラジルを使用し、それ以外はシステムの地域設定から推定した国を使用します。",
        holidayHintIran: "内蔵のオフライン・イラン祝日リストを使用します — ネット接続は不要です。",
        holidayHintCustom: "2文字の国コードを入力してください（ISO 3166-1、例：US、DE、GB、FR）。公開の国際祝日ソースから取得します。",
        quotesTitle: "毎日の名言・格言", religionSource: "宗教的な一節のソース", poetrySource: "詩・文学のソース",
        religionIslam: "☪️ イスラム教", religionJudaism: "✡️ ユダヤ教", religionChristianity: "✝️ キリスト教", religionEastern: "☸️ 東洋（仏教・ヒンドゥーの知恵）",
        poetryRumi: "🌙 ルーミー", poetryWestern: "🖋️ 西洋文学",
        vaultLiveSaved: "✓ 即座に保存されました — 「保存」を押す必要はありません",
        lblCreateVoidTab: "Void Galaxy",
        lblRestoreHome: "ホーム",
        restoreHomeHint: "chrome://settings/onStartup を開き、「新しいタブページを開く」を選んで既定に戻してください。",
        lblCopyVoidHome: "リンクをコピー",
        lblNtpMode: "新しいタブの動作",
        lblUseDefaultNtp: "代わりに標準の検索エンジンにリダイレクトする",
        toastNtpDefaultOn: "標準の新しいタブが有効になりました",
        toastNtpDefaultOff: "Void Galaxy の新しいタブに戻りました",
        voidHomeCopiedHint: "✅ コピーしました！Chromeの設定→起動時→特定のページを開く、に貼り付けてください"
      },
      ru: {
        tabCore: "⚙️ Основное", tabBackup: "🛡️ Резервная копия", tabVault: "✨ Хранилище",
        lblLanguage: "Язык приложения:", lblBirth: "Возраст семьи",
        btnSave: "Сохранить настройки", btnExport: "📤 Экспорт резервной копии (JSON)", btnImport: "📥 Импорт резервной копии (восстановление)",
        toastSaved: "Настройки успешно сохранены!", toastExported: "Файл JSON скачан!", toastImported: "Данные успешно импортированы!", toastRestored: "Данные успешно восстановлены!",
        invalidFile: "Неверный формат файла.", errRead: "Ошибка при чтении файла JSON.",
        btnHide: "Скрыть", btnShow: "Показать (сбросить)",
        backupHint: "🟢 Экспорт сохраняет всё — закладки, задачи, события и отметки календаря, настройки, блокнот, часто используемые ссылки &nbsp;·&nbsp; 🟠 Импорт восстанавливает всё из файла",
        contactTitle: "✉︎ Связаться с нами", contactEmail: "Эл. почта:",
        holidaysTitle: "Официальные праздники", holidaysEnable: "Показывать официальные праздники в календаре",
        holidayAuto: "Авто — по языку приложения", holidayIran: "Иран (офлайн, проверенный список)", holidayCustom: "Другая страна (введите код)",
        holidayHintAuto: "Сейчас использует Иран, если язык приложения персидский, Россию — если русский, Турцию — если турецкий, Китай — если китайский (упрощённый), Тайвань — если китайский (традиционный), Бразилию — если португальский (Бразилия); в остальных случаях — страну, определённую по региональным настройкам системы.",
        holidayHintIran: "Использует встроенный офлайн-список иранских праздников — подключение к интернету не требуется.",
        holidayHintCustom: "Введите двухбуквенный код страны (ISO 3166-1, напр. US, DE, GB, FR). Данные берутся из открытого международного источника праздников.",
        quotesTitle: "Ежедневные мудрые цитаты", religionSource: "Источник духовного стиха", poetrySource: "Источник поэзии и литературы",
        religionIslam: "☪️ Ислам", religionJudaism: "✡️ Иудаизм", religionChristianity: "✝️ Христианство", religionEastern: "☸️ Восточная (буддийская и индуистская мудрость)",
        poetryRumi: "🌙 Руми", poetryWestern: "🖋️ Западная литература",
        vaultLiveSaved: "✓ Сохранено мгновенно — нажимать «Сохранить» не нужно",
        lblCreateVoidTab: "Void Galaxy",
        lblRestoreHome: "Домой",
        restoreHomeHint: "Перейдите в chrome://settings/onStartup и выберите «Открывать страницу новой вкладки», чтобы восстановить по умолчанию.",
        lblCopyVoidHome: "Скопировать ссылку",
        lblNtpMode: "Поведение новой вкладки",
        lblUseDefaultNtp: "Вместо этого перенаправлять на стандартную поисковую систему",
        toastNtpDefaultOn: "Стандартная новая вкладка включена",
        toastNtpDefaultOff: "Новая вкладка Void Galaxy восстановлена",
        voidHomeCopiedHint: "✅ Скопировано! Вставьте в настройках Chrome → При запуске → Открыть конкретную страницу"
      },
      tr: {
        tabCore: "⚙️ Genel", tabBackup: "🛡️ Yedekleme", tabVault: "✨ Hazine",
        lblLanguage: "Uygulama Dili:", lblBirth: "Aile yaşları",
        btnSave: "Ayarları Kaydet", btnExport: "📤 Yedeği Dışa Aktar (JSON)", btnImport: "📥 Yedeği İçe Aktar (Geri Yükle)",
        toastSaved: "Ayarlar başarıyla kaydedildi!", toastExported: "JSON dosyası indirildi!", toastImported: "Veriler başarıyla içe aktarıldı!", toastRestored: "Veriler başarıyla geri yüklendi!",
        invalidFile: "Geçersiz dosya biçimi.", errRead: "JSON dosyası okunurken hata oluştu.",
        btnHide: "Gizle", btnShow: "Göster (Sıfırla)",
        backupHint: "🟢 Dışa aktarma her şeyi kaydeder — yer imleri, görevler, takvim etkinlikleri ve özel günler, ayarlar, not defteri, sık kullanılan bağlantılar &nbsp;·&nbsp; 🟠 İçe aktarma her şeyi bir dosyadan geri yükler",
        contactTitle: "✉︎ Bize Ulaşın", contactEmail: "E-posta:",
        holidaysTitle: "Resmi Tatiller", holidaysEnable: "Takvimde resmi tatilleri göster",
        holidayAuto: "Otomatik — uygulama diline göre", holidayIran: "İran (çevrimdışı, düzenlenmiş liste)", holidayCustom: "Diğer ülke (kod girin)",
        holidayHintAuto: "Uygulama dili Farsça olduğunda İran'ı, Rusça olduğunda Rusya'yı, Türkçe olduğunda Türkiye'yi, Basitleştirilmiş Çince olduğunda Çin'i, Geleneksel Çince olduğunda Tayvan'ı, Portekizce (Brezilya) olduğunda Brezilya'yı kullanır; aksi hâlde sistem bölge ayarınızdan tahmin edilen bir ülkeyi kullanır.",
        holidayHintIran: "Yerleşik çevrimdışı İran tatil listesini kullanır — internet bağlantısı gerekmez.",
        holidayHintCustom: "2 harfli bir ülke kodu girin (ISO 3166-1, ör. US, DE, GB, FR). Genel bir uluslararası tatil kaynağından alınır.",
        quotesTitle: "Günlük Bilgelik Sözleri", religionSource: "Manevi ayet kaynağı", poetrySource: "Şiir ve edebiyat kaynağı",
        religionIslam: "☪️ İslam", religionJudaism: "✡️ Yahudilik", religionChristianity: "✝️ Hristiyanlık", religionEastern: "☸️ Doğu (Budist ve Hindu bilgeliği)",
        poetryRumi: "🌙 Mevlana", poetryWestern: "🖋️ Batı Edebiyatı",
        vaultLiveSaved: "✓ Anında kaydedildi — «Kaydet»e basmaya gerek yok",
        lblCreateVoidTab: "Void Galaxy",
        lblRestoreHome: "Ana Sayfa",
        restoreHomeHint: "chrome://settings/onStartup adresine git ve varsayılana dönmek için \"Yeni sekme sayfasını aç\" seçeneğini seç.",
        lblCopyVoidHome: "Bağlantıyı Kopyala",
        lblNtpMode: "Yeni Sekme Davranışı",
        lblUseDefaultNtp: "Bunun yerine standart arama motoruna yönlendir",
        toastNtpDefaultOn: "Standart Yeni Sekme etkinleştirildi",
        toastNtpDefaultOff: "Void Galaxy Yeni Sekmesi geri yüklendi",
        voidHomeCopiedHint: "✅ Kopyalandı! Chrome Ayarları → Başlangıçta → Belirli bir sayfa aç kısmına yapıştır"
      },
      'zh-Hans': {
        tabCore: "⚙️ 核心", tabBackup: "🛡️ 备份", tabVault: "✨ 宝藏",
        lblLanguage: "应用语言：", lblBirth: "家庭年龄",
        btnSave: "保存设置", btnExport: "📤 导出备份 (JSON)", btnImport: "📥 导入备份（恢复）",
        toastSaved: "设置已成功保存！", toastExported: "JSON 文件已下载！", toastImported: "数据已成功导入！", toastRestored: "备份已成功恢复！",
        invalidFile: "文件格式无效。", errRead: "读取 JSON 文件时出错。",
        btnHide: "隐藏", btnShow: "显示（重置）",
        backupHint: "🟢 导出会保存全部内容——书签、待办事项、日历事件与纪念日、设置、记事本、常用链接 &nbsp;·&nbsp; 🟠 导入会从文件恢复全部内容",
        contactTitle: "✉︎ 联系我们", contactEmail: "邮箱：",
        holidaysTitle: "法定节假日", holidaysEnable: "在日历上显示法定节假日",
        holidayAuto: "自动——跟随应用语言", holidayIran: "伊朗（离线、精选列表）", holidayCustom: "其他国家（输入代码）",
        holidayHintAuto: "应用语言为波斯语时使用伊朗，俄语时使用俄罗斯，土耳其语时使用土耳其，简体中文时使用中国，繁体中文时使用台湾，巴西葡萄牙语时使用巴西；其他情况会根据系统区域设置猜测国家。",
        holidayHintIran: "使用内置的离线伊朗节假日列表——无需联网。",
        holidayHintCustom: "输入两位国家代码（ISO 3166-1，例如 US、DE、GB、FR）。数据来自通用的国际节假日源。",
        quotesTitle: "每日箴言", religionSource: "灵性经文来源", poetrySource: "诗歌与文学来源",
        religionIslam: "☪️ 伊斯兰教", religionJudaism: "✡️ 犹太教", religionChristianity: "✝️ 基督教", religionEastern: "☸️ 东方（佛教与印度教智慧）",
        poetryRumi: "🌙 鲁米", poetryWestern: "🖋️ 西方文学",
        vaultLiveSaved: "✓ 已即时保存——无需点击「保存」",
        lblCreateVoidTab: "Void Galaxy",
        lblRestoreHome: "主页",
        restoreHomeHint: "前往 chrome://settings/onStartup，选择“打开新标签页”即可恢复默认设置。",
        lblCopyVoidHome: "复制链接",
        lblNtpMode: "新标签页行为",
        lblUseDefaultNtp: "改为跳转到标准搜索引擎",
        toastNtpDefaultOn: "已启用标准新标签页",
        toastNtpDefaultOff: "已恢复 Void Galaxy 新标签页",
        voidHomeCopiedHint: "✅ 已复制！粘贴到 Chrome 设置 → 启动时 → 打开特定网页"
      },
      'zh-Hant': {
        tabCore: "⚙️ 核心", tabBackup: "🛡️ 備份", tabVault: "✨ 寶藏",
        lblLanguage: "應用程式語言：", lblBirth: "家庭年齡",
        btnSave: "儲存設定", btnExport: "📤 匯出備份 (JSON)", btnImport: "📥 匯入備份（還原）",
        toastSaved: "設定已成功儲存！", toastExported: "JSON 檔案已下載！", toastImported: "資料已成功匯入！", toastRestored: "備份已成功還原！",
        invalidFile: "檔案格式無效。", errRead: "讀取 JSON 檔案時發生錯誤。",
        btnHide: "隱藏", btnShow: "顯示（重置）",
        backupHint: "🟢 匯出會儲存全部內容——書籤、待辦事項、行事曆活動與紀念日、設定、記事本、常用連結 &nbsp;·&nbsp; 🟠 匯入會從檔案還原全部內容",
        contactTitle: "✉︎ 聯絡我們", contactEmail: "電子郵件：",
        holidaysTitle: "法定假日", holidaysEnable: "在行事曆上顯示法定假日",
        holidayAuto: "自動——跟隨應用程式語言", holidayIran: "伊朗（離線、精選清單）", holidayCustom: "其他國家（輸入代碼）",
        holidayHintAuto: "應用程式語言為波斯語時使用伊朗，俄語時使用俄羅斯，土耳其語時使用土耳其，簡體中文時使用中國，繁體中文時使用台灣，巴西葡萄牙語時使用巴西；其他情況會依系統地區設定猜測國家。",
        holidayHintIran: "使用內建的離線伊朗假日清單——不需要網路連線。",
        holidayHintCustom: "輸入兩位國家代碼（ISO 3166-1，例如 US、DE、GB、FR）。資料來自通用的國際假日來源。",
        quotesTitle: "每日箴言", religionSource: "靈性經文來源", poetrySource: "詩歌與文學來源",
        religionIslam: "☪️ 伊斯蘭教", religionJudaism: "✡️ 猶太教", religionChristianity: "✝️ 基督教", religionEastern: "☸️ 東方（佛教與印度教智慧）",
        poetryRumi: "🌙 魯米", poetryWestern: "🖋️ 西方文學",
        vaultLiveSaved: "✓ 已即時儲存——無需點擊「儲存」",
        lblCreateVoidTab: "Void Galaxy",
        lblRestoreHome: "首頁",
        restoreHomeHint: "前往 chrome://settings/onStartup，選擇「開啟新分頁」即可還原預設值。",
        lblCopyVoidHome: "複製連結",
        lblNtpMode: "新分頁行為",
        lblUseDefaultNtp: "改為跳轉到標準搜尋引擎",
        toastNtpDefaultOn: "已啟用標準新分頁",
        toastNtpDefaultOff: "已還原 Void Galaxy 新分頁",
        voidHomeCopiedHint: "✅ 已複製！貼到 Chrome 設定 → 啟動時 → 開啟特定網頁"
      },
      'pt-BR': {
        tabCore: "⚙️ Principal", tabBackup: "🛡️ Backup", tabVault: "✨ Tesouro",
        lblLanguage: "Idioma do aplicativo:", lblBirth: "Idades da família",
        btnSave: "Salvar Configurações", btnExport: "📤 Exportar Backup (JSON)", btnImport: "📥 Importar Backup (Restaurar)",
        toastSaved: "Configurações salvas com sucesso!", toastExported: "Arquivo JSON baixado!", toastImported: "Dados importados com sucesso!", toastRestored: "Backup restaurado com sucesso!",
        invalidFile: "Formato de arquivo inválido.", errRead: "Erro ao ler o arquivo JSON.",
        btnHide: "Ocultar", btnShow: "Mostrar (Redefinir)",
        backupHint: "🟢 A exportação salva tudo — favoritos, tarefas, eventos e datas do calendário, configurações, bloco de notas, links frequentes &nbsp;·&nbsp; 🟠 A importação restaura tudo a partir de um arquivo",
        contactTitle: "✉︎ Fale Conosco", contactEmail: "E-mail:",
        holidaysTitle: "Feriados Oficiais", holidaysEnable: "Mostrar feriados oficiais no calendário",
        holidayAuto: "Automático — seguir o idioma do aplicativo", holidayIran: "Irã (offline, lista selecionada)", holidayCustom: "Outro país (digite o código)",
        holidayHintAuto: "Usa o Irã quando o idioma é persa, a Rússia quando é russo, a Turquia quando é turco, a China quando é chinês simplificado, Taiwan quando é chinês tradicional, o Brasil quando é português (Brasil); caso contrário, tenta adivinhar o país pela configuração regional do sistema.",
        holidayHintIran: "Usa a lista offline embutida de feriados do Irã — não precisa de internet.",
        holidayHintCustom: "Digite um código de país de 2 letras (ISO 3166-1, ex.: US, DE, GB, FR). Os dados vêm de uma fonte internacional geral de feriados.",
        quotesTitle: "Sabedoria Diária", religionSource: "Fonte de versículos espirituais", poetrySource: "Fonte de poesia e literatura",
        religionIslam: "☪️ Islamismo", religionJudaism: "✡️ Judaísmo", religionChristianity: "✝️ Cristianismo", religionEastern: "☸️ Oriental (sabedoria budista e hindu)",
        poetryRumi: "🌙 Rumi", poetryWestern: "🖋️ Literatura Ocidental",
        vaultLiveSaved: "✓ Salvo instantaneamente — não é preciso clicar em Salvar",
        lblCreateVoidTab: "Void Galaxy",
        lblRestoreHome: "Início",
        restoreHomeHint: "Vá em chrome://settings/onStartup e escolha \"Abrir a página Nova guia\" para restaurar o padrão.",
        lblCopyVoidHome: "Copiar Link",
        lblNtpMode: "Comportamento da Nova Guia",
        lblUseDefaultNtp: "Redirecionar para o mecanismo de busca padrão em vez disso",
        toastNtpDefaultOn: "Nova guia padrão ativada",
        toastNtpDefaultOff: "Nova guia do Void Galaxy restaurada",
        voidHomeCopiedHint: "✅ Copiado! Cole em Configurações do Chrome → Ao iniciar → Abrir uma página específica"
      }
    };

    // New, independent Music Orb labels. Kept separate from the legacy Launcher labels
    // so the two controls cannot be conflated.
    const musicOrbI18n = {
      en: { title: "Music Orb on this site", show: "Show orb", hide: "Hide orb", on: "Authorized on this site", off: "Hidden on this site", invalid: "Saved preference is invalid", unavailable: "Unavailable on this page" },
      fa: { title: "Orb موسیقی در این سایت", show: "نمایش Orb", hide: "پنهان کردن Orb", on: "در این سایت مجاز است", off: "در این سایت پنهان است", invalid: "تنظیم ذخیره‌شده نامعتبر است", unavailable: "در این صفحه در دسترس نیست" },
      ar: { title: "كرة الموسيقى على هذا الموقع", show: "إظهار الكرة", hide: "إخفاء الكرة", on: "مسموح بها على هذا الموقع", off: "مخفية على هذا الموقع", invalid: "التفضيل المحفوظ غير صالح", unavailable: "غير متاحة في هذه الصفحة" },
      es: { title: "Orbe de música en este sitio", show: "Mostrar orbe", hide: "Ocultar orbe", on: "Autorizado en este sitio", off: "Oculto en este sitio", invalid: "La preferencia guardada no es válida", unavailable: "No disponible en esta página" },
      de: { title: "Musik-Orb auf dieser Website", show: "Orb anzeigen", hide: "Orb ausblenden", on: "Auf dieser Website autorisiert", off: "Auf dieser Website ausgeblendet", invalid: "Gespeicherte Einstellung ist ungültig", unavailable: "Auf dieser Seite nicht verfügbar" },
      fr: { title: "Orbe musical sur ce site", show: "Afficher l’orbe", hide: "Masquer l’orbe", on: "Autorisé sur ce site", off: "Masqué sur ce site", invalid: "La préférence enregistrée est invalide", unavailable: "Indisponible sur cette page" },
      ja: { title: "このサイトのミュージックオーブ", show: "オーブを表示", hide: "オーブを非表示", on: "このサイトで許可済み", off: "このサイトで非表示", invalid: "保存された設定が無効です", unavailable: "このページでは利用できません" },
      ru: { title: "Музыкальная сфера на этом сайте", show: "Показать сферу", hide: "Скрыть сферу", on: "Разрешена на этом сайте", off: "Скрыта на этом сайте", invalid: "Сохранённая настройка недействительна", unavailable: "Недоступно на этой странице" },
      tr: { title: "Bu sitede müzik küresi", show: "Küreyi göster", hide: "Küreyi gizle", on: "Bu sitede izin verildi", off: "Bu sitede gizli", invalid: "Kayıtlı tercih geçersiz", unavailable: "Bu sayfada kullanılamaz" },
      "zh-Hans": { title: "此网站的音乐球", show: "显示音乐球", hide: "隐藏音乐球", on: "已在此网站授权", off: "已在此网站隐藏", invalid: "保存的偏好无效", unavailable: "此页面不可用" },
      "zh-Hant": { title: "此網站的音樂球", show: "顯示音樂球", hide: "隱藏音樂球", on: "已在此網站授權", off: "已在此網站隱藏", invalid: "儲存的偏好無效", unavailable: "此頁面無法使用" },
      "pt-BR": { title: "Orbe de música neste site", show: "Mostrar orbe", hide: "Ocultar orbe", on: "Autorizado neste site", off: "Oculto neste site", invalid: "A preferência guardada é inválida", unavailable: "Indisponível nesta página" }
    };

    let currentLang = 'en';
    const SITE_DISPLAY_KEY = 'voidGalaxySiteDisplay';
    let musicOrbTabId = null, musicOrbOrigin = '', musicOrbPref = 'unset', musicOrbSupported = false, musicOrbBusy = false, musicOrbStorageOK = true, musicOrbMapMalformed = false;
    function musicOrbText() { return musicOrbI18n[currentLang] || musicOrbI18n.en; }

    function applyTranslation() {
      // اگر زبانی به هر دلیل هنوز دیکشنری کامل ندارد، به انگلیسی برمی‌گردیم — تا
      // پاپ‌آپ هرگز به‌خاطر یک زبان ناقص کرش نکند (شبیه fallback خودِ t() در content.js)
      const t = i18nPopup[currentLang] || i18nPopup.en;
      document.body.className = (currentLang === 'fa' || currentLang === 'ar') ? 'rtl' : '';

      // بخش مناسبت‌های ایران فقط در زبان فارسی در تب Backup دیده می‌شود
      const iranSec = document.getElementById('iran-holidays-section');
      if (iranSec) iranSec.style.display = (currentLang === 'fa') ? 'block' : 'none';

      document.getElementById('tab-core').textContent = t.tabCore;
      document.getElementById('tab-backup').textContent = t.tabBackup;
      const vaultTab = document.getElementById('tab-vault');
      if (vaultTab) vaultTab.textContent = t.tabVault;
      document.getElementById('lbl-language').textContent = t.lblLanguage;
      document.getElementById('lbl-birth').textContent = t.lblBirth;
      const hint = document.getElementById('birth-date-hint');
      if (hint) hint.textContent = familyUiText('hint') + ' · ' + familyUiText('dateOrder');
      const addBtn = document.getElementById('family-age-add-btn');
      if (addBtn) addBtn.textContent = familyUiText('add');
      const autoHint = document.getElementById('family-ages-autosave-hint');
      if (autoHint) autoHint.textContent = familyUiText('autoSave');
      if (typeof renderFamilyAgesList === 'function') renderFamilyAgesList();
      document.getElementById('saveSettingsBtn').textContent = t.btnSave;
      if (document.getElementById('lbl-create-void-tab')) document.getElementById('lbl-create-void-tab').textContent = t.lblCreateVoidTab;
      if (document.getElementById('lbl-restore-home')) document.getElementById('lbl-restore-home').textContent = t.lblRestoreHome;
      if (document.getElementById('lbl-copy-void-home')) document.getElementById('lbl-copy-void-home').textContent = t.lblCopyVoidHome;
      if (document.getElementById('lbl-ntp-mode')) document.getElementById('lbl-ntp-mode').textContent = t.lblNtpMode;
      if (document.getElementById('lbl-use-default-ntp')) document.getElementById('lbl-use-default-ntp').textContent = t.lblUseDefaultNtp;
      document.getElementById('exportJsonBtn').textContent = t.btnExport;
      document.getElementById('importJsonBtn').textContent = t.btnImport;

      const hideBtn = document.getElementById('hideOnPageBtn');
      if (hideBtn) hideBtn.textContent = t.btnHide;

      const showBtn = document.getElementById('showOnPageBtn');
      if (showBtn) showBtn.textContent = t.btnShow;

      const backupHint = document.getElementById('backup-hint');
      if (backupHint) backupHint.innerHTML = t.backupHint;

      const contactTitle = document.getElementById('lbl-contact-title');
      if (contactTitle) contactTitle.textContent = t.contactTitle;

      const contactEmail = document.getElementById('lbl-contact-email');
      if (contactEmail) contactEmail.textContent = t.contactEmail;

      const hTitle = document.getElementById('lbl-holidays-title');
      if (hTitle) hTitle.textContent = t.holidaysTitle;
      const hEnable = document.getElementById('lbl-holidays-enable');
      if (hEnable) hEnable.textContent = t.holidaysEnable;
      const optAuto = document.getElementById('opt-holiday-auto');
      if (optAuto) optAuto.textContent = t.holidayAuto;
      const optIran = document.getElementById('opt-holiday-ir');
      if (optIran) optIran.textContent = t.holidayIran;
      const optCustom = document.getElementById('opt-holiday-custom');
      if (optCustom) optCustom.textContent = t.holidayCustom;
      updateHolidayRegionHint();

      const qTitle = document.getElementById('lbl-quotes-title');
      if (qTitle) qTitle.textContent = t.quotesTitle;
      const rLbl = document.getElementById('lbl-religion-source');
      if (rLbl) rLbl.textContent = t.religionSource;
      const pLbl = document.getElementById('lbl-poetry-source');
      if (pLbl) pLbl.textContent = t.poetrySource;

      const optIslam = document.getElementById('opt-religion-islam');
      if (optIslam) optIslam.textContent = t.religionIslam;
      const optJudaism = document.getElementById('opt-religion-judaism');
      if (optJudaism) optJudaism.textContent = t.religionJudaism;
      const optChristianity = document.getElementById('opt-religion-christianity');
      if (optChristianity) optChristianity.textContent = t.religionChristianity;
      const optEastern = document.getElementById('opt-religion-eastern');
      if (optEastern) optEastern.textContent = t.religionEastern;

      const optRumi = document.getElementById('opt-poetry-rumi');
      if (optRumi) optRumi.textContent = t.poetryRumi;
      const optWestern = document.getElementById('opt-poetry-western');
      if (optWestern) optWestern.textContent = t.poetryWestern;
      renderMusicOrbControl();
      if (typeof renderLauncherSiteControl === 'function') renderLauncherSiteControl();
    }

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
      });
    });


    const userBirthYearInput = document.getElementById('userBirthYear');
    const familyAgesListEl = document.getElementById('family-ages-list');
    const familyAgeAddBtn = document.getElementById('family-age-add-btn');
    const familyCollapseBtn = document.getElementById('family-ages-collapse-btn');
    const familyAgesPanel = document.getElementById('family-ages-panel');
    const FAMILY_MAX = 12;
    let familyAges = [];
    let familyAutoSaveTimer = null;

    function newFamilyId() {
      return 'fa_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }
    function normalizeFamilyMember(raw) {
      if (!raw || typeof raw !== 'object') return null;
      const year = parseInt(raw.year != null ? raw.year : raw.y, 10);
      if (!year || year < 1 || year > 2200) return null;
      let month = parseInt(raw.month != null ? raw.month : raw.m, 10);
      let day = parseInt(raw.day != null ? raw.day : raw.d, 10);
      if (!month || month < 1 || month > 12) month = null;
      if (!day || day < 1 || day > 31) day = null;
      return {
        id: String(raw.id || newFamilyId()).slice(0, 40),
        name: String(raw.name || raw.label || '').trim().slice(0, 24),
        year: year, month: month, day: day, primary: !!raw.primary
      };
    }
    function normalizeFamilyList(list) {
      if (!Array.isArray(list)) return [];
      const out = [];
      const seen = new Set();
      list.forEach((item, i) => {
        const n = normalizeFamilyMember(item);
        if (!n) return;
        if (seen.has(n.id)) n.id = n.id + '_' + i;
        seen.add(n.id);
        out.push(n);
      });
      if (out.length && out.filter(m => m.primary).length !== 1) {
        out.forEach((m, i) => { m.primary = (i === 0); });
      }
      return out.slice(0, FAMILY_MAX);
    }
    function primaryMember() {
      return familyAges.find(m => m.primary) || familyAges[0] || null;
    }
    function syncLegacyBirthYear() {
      const p = primaryMember();
      if (userBirthYearInput) userBirthYearInput.value = p ? String(p.year) : '';
    }
    function familyUiText(key) {
      const packs = {
        en: { namePh:'Name (e.g. Me, Dad)', yearPh:'YYYY', monthPh:'MM', dayPh:'DD', yearLabel:'Year', monthLabel:'Month (1–12)', dayLabel:'Day (1–31)', dateOrder:'Date order: YYYY-MM-DD (year-month-day).', primary:'Primary (default display)', del:'Remove', add:'+ Add person', empty:'No one yet — add yourself or family members.', hint:'Year < 1500 = Jalali · else Gregorian. Mark one person as primary.', meDefault:'Me', autoSave:'Changes save automatically.', saved:'Saved' },
        fa: { namePh:'نام (مثلاً من، پدر)', yearPh:'YYYY', monthPh:'MM', dayPh:'DD', yearLabel:'سال', monthLabel:'ماه (۱ تا ۱۲)', dayLabel:'روز (۱ تا ۳۱)', dateOrder:'ترتیب تاریخ: YYYY-MM-DD (سال-ماه-روز).', primary:'اصلی (نمایش پیش‌فرض)', del:'حذف', add:'+ افزودن فرد', empty:'هنوز کسی اضافه نشده — خودتان یا اعضای خانواده را وارد کنید.', hint:'سال < ۱۵۰۰ = شمسی · وگرنه میلادی. یک نفر را به‌عنوان اصلی انتخاب کنید.', meDefault:'من', autoSave:'تغییرات به‌صورت خودکار ذخیره می‌شوند.', saved:'ذخیره شد' },
        ar: { namePh:'الاسم', yearPh:'سنة', monthPh:'شهر', dayPh:'يوم', primary:'أساسي', del:'حذف', add:'+ إضافة شخص', empty:'لم يُضف أحد بعد.', hint:'السنة < 1500 = شمسي · وإلا ميلادي.', meDefault:'أنا', autoSave:'يتم الحفظ تلقائيًا.', saved:'تم الحفظ' },
        es: { namePh:'Nombre', yearPh:'Año', monthPh:'M', dayPh:'D', primary:'Principal', del:'Eliminar', add:'+ Añadir persona', empty:'Nadie aún.', hint:'Año < 1500 = Jalali · si no, gregoriano.', meDefault:'Yo', autoSave:'Los cambios se guardan solos.', saved:'Guardado' },
        de: { namePh:'Name', yearPh:'Jahr', monthPh:'M', dayPh:'T', primary:'Primär', del:'Entfernen', add:'+ Person hinzufügen', empty:'Noch niemand.', hint:'Jahr < 1500 = Jalali · sonst gregorianisch.', meDefault:'Ich', autoSave:'Änderungen werden automatisch gespeichert.', saved:'Gespeichert' },
        fr: { namePh:'Nom', yearPh:'Année', monthPh:'M', dayPh:'J', primary:'Principal', del:'Supprimer', add:'+ Ajouter', empty:'Personne pour l\'instant.', hint:'Année < 1500 = jalali · sinon grégorien.', meDefault:'Moi', autoSave:'Enregistrement automatique.', saved:'Enregistré' },
        ja: { namePh:'名前', yearPh:'年', monthPh:'月', dayPh:'日', primary:'メイン', del:'削除', add:'+ 追加', empty:'まだ誰もいません。', hint:'年 < 1500 = ジャラーリー · それ以外はグレゴリオ暦。', meDefault:'自分', autoSave:'変更は自動保存されます。', saved:'保存しました' },
        ru: { namePh:'Имя', yearPh:'Год', monthPh:'М', dayPh:'Д', primary:'Основной', del:'Удалить', add:'+ Добавить', empty:'Пока никого.', hint:'Год < 1500 = джалали · иначе григорианский.', meDefault:'Я', autoSave:'Изменения сохраняются автоматически.', saved:'Сохранено' },
        tr: { namePh:'Ad', yearPh:'Yıl', monthPh:'A', dayPh:'G', primary:'Birincil', del:'Kaldır', add:'+ Ekle', empty:'Henüz kimse yok.', hint:'Yıl < 1500 = Celali · aksi halde Gregoryen.', meDefault:'Ben', autoSave:'Değişiklikler otomatik kaydedilir.', saved:'Kaydedildi' },
        'zh-Hans': { namePh:'姓名', yearPh:'年', monthPh:'月', dayPh:'日', primary:'主要', del:'删除', add:'+ 添加', empty:'还没有人。', hint:'年份 < 1500 = 波斯历 · 否则为公历。', meDefault:'我', autoSave:'更改会自动保存。', saved:'已保存' },
        'zh-Hant': { namePh:'姓名', yearPh:'年', monthPh:'月', dayPh:'日', primary:'主要', del:'刪除', add:'+ 新增', empty:'尚無任何人。', hint:'年份 < 1500 = 波斯曆 · 否則為公曆。', meDefault:'我', autoSave:'變更會自動儲存。', saved:'已儲存' },
        'pt-BR': { namePh:'Nome', yearPh:'Ano', monthPh:'M', dayPh:'D', primary:'Principal', del:'Remover', add:'+ Adicionar', empty:'Ninguém ainda.', hint:'Ano < 1500 = Jalali · senão gregoriano.', meDefault:'Eu', autoSave:'Alterações salvas automaticamente.', saved:'Salvo' }
      };
      const pack = packs[currentLang] || packs.en;
      return pack[key] || packs.en[key] || key;
    }
    function collectFamilyFromDom() {
      if (!familyAgesListEl) return;
      familyAgesListEl.querySelectorAll('.family-age-row').forEach((row) => {
        const id = row.dataset.id;
        const m = familyAges.find(x => x.id === id);
        if (!m) return;
        const nameIn = row.querySelector('.family-age-row-top input[type="text"]');
        const dateIns = row.querySelectorAll('.family-age-row-dates input');
        if (nameIn) m.name = (nameIn.value || '').trim().slice(0, 24);
        if (dateIns[0] && dateIns[0].value) {
          const y = parseInt(dateIns[0].value, 10);
          if (y >= 1 && y <= 2200) m.year = y;
        }
        if (dateIns[1]) {
          const mo = parseInt(dateIns[1].value, 10);
          m.month = (mo >= 1 && mo <= 12) ? mo : null;
        }
        if (dateIns[2]) {
          const d = parseInt(dateIns[2].value, 10);
          m.day = (d >= 1 && d <= 31) ? d : null;
        }
        const prim = row.querySelector('input[type="radio"]');
        if (prim) m.primary = !!prim.checked;
      });
      familyAges = normalizeFamilyList(familyAges.filter(m => m.year));
      if (familyAges.length && !familyAges.some(m => m.primary)) familyAges[0].primary = true;
      syncLegacyBirthYear();
    }
    function saveFamilyAgesNow(showFlash) {
      collectFamilyFromDom();
      const prim = primaryMember();
      chrome.storage.sync.set({
        userBirthYear: prim ? prim.year : '',
        userBirthMonth: (prim && prim.month) ? prim.month : '',
        userBirthDay: (prim && prim.day) ? prim.day : '',
        aiTreeFamilyAges: familyAges
      }, () => {
        if (showFlash) {
          const autoHint = document.getElementById('family-ages-autosave-hint');
          if (autoHint) {
            autoHint.textContent = familyUiText('saved');
            autoHint.style.color = '#6EE7B7';
            setTimeout(() => { autoHint.textContent = familyUiText('autoSave'); autoHint.style.color = ''; }, 1200);
          }
        }
        if (typeof broadcastRefresh === 'function') broadcastRefresh();
      });
    }
    function scheduleFamilyAutoSave() {
      if (familyAutoSaveTimer) clearTimeout(familyAutoSaveTimer);
      familyAutoSaveTimer = setTimeout(() => saveFamilyAgesNow(true), 450);
    }
    function renderFamilyAgesList() {
      if (!familyAgesListEl) return;
      familyAgesListEl.innerHTML = '';
      if (!familyAges.length) {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size:11px;color:var(--text-muted);padding:4px 2px;';
        empty.textContent = familyUiText('empty');
        familyAgesListEl.appendChild(empty);
        return;
      }
      familyAges.forEach((member) => {
        const row = document.createElement('div');
        row.className = 'family-age-row' + (member.primary ? ' is-primary' : '');
        row.dataset.id = member.id;
        const top = document.createElement('div');
        top.className = 'family-age-row-top';
        const nameIn = document.createElement('input');
        nameIn.type = 'text'; nameIn.maxLength = 24;
        nameIn.placeholder = familyUiText('namePh');
        nameIn.value = member.name || ''; nameIn.dir = 'auto';
        nameIn.addEventListener('input', () => { member.name = (nameIn.value || '').trim().slice(0, 24); scheduleFamilyAutoSave(); });
        top.appendChild(nameIn);
        const dates = document.createElement('div');
        dates.className = 'family-age-row-dates';
        function numInput(ph, val, min, max, onChange, accessibleLabel) {
          const inp = document.createElement('input');
          inp.type = 'number'; inp.placeholder = ph; inp.min = String(min); inp.max = String(max);
          inp.setAttribute('aria-label', accessibleLabel || ph);
          inp.title = accessibleLabel || ph;
          if (val != null && val !== '') inp.value = String(val);
          const go = () => { const n = parseInt(inp.value, 10); onChange((n >= min && n <= max) ? n : null); scheduleFamilyAutoSave(); };
          inp.addEventListener('input', go); inp.addEventListener('change', go);
          return inp;
        }
        dates.appendChild(numInput(familyUiText('yearPh'), member.year, 1, 2200, (n) => { if (n) member.year = n; }, familyUiText('yearLabel')));
        dates.appendChild(numInput(familyUiText('monthPh'), member.month, 1, 12, (n) => { member.month = n; }, familyUiText('monthLabel')));
        dates.appendChild(numInput(familyUiText('dayPh'), member.day, 1, 31, (n) => { member.day = n; }, familyUiText('dayLabel')));
        const actions = document.createElement('div');
        actions.className = 'family-age-row-actions';
        const primLabel = document.createElement('label');
        primLabel.className = 'family-age-primary-label';
        const primCb = document.createElement('input');
        primCb.type = 'radio'; primCb.name = 'family-primary'; primCb.checked = !!member.primary;
        primCb.addEventListener('change', () => {
          if (!primCb.checked) return;
          familyAges.forEach(m => { m.primary = (m.id === member.id); });
          syncLegacyBirthYear(); renderFamilyAgesList(); scheduleFamilyAutoSave();
        });
        primLabel.appendChild(primCb);
        primLabel.appendChild(document.createTextNode(' ' + familyUiText('primary')));
        const delBtn = document.createElement('button');
        delBtn.type = 'button'; delBtn.className = 'family-age-del'; delBtn.textContent = familyUiText('del');
        delBtn.addEventListener('click', () => {
          familyAges = familyAges.filter(m => m.id !== member.id);
          if (familyAges.length && !familyAges.some(m => m.primary)) familyAges[0].primary = true;
          syncLegacyBirthYear(); renderFamilyAgesList(); scheduleFamilyAutoSave();
        });
        actions.appendChild(primLabel); actions.appendChild(delBtn);
        row.appendChild(top); row.appendChild(dates); row.appendChild(actions);
        familyAgesListEl.appendChild(row);
      });
    }
    if (familyCollapseBtn && familyAgesPanel) {
      familyCollapseBtn.addEventListener('click', () => {
        const open = familyCollapseBtn.getAttribute('aria-expanded') === 'true';
        const next = !open;
        familyCollapseBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
        familyAgesPanel.hidden = !next;
        familyAgesPanel.style.display = next ? '' : 'none';
      });
    }
    if (familyAgeAddBtn) {
      familyAgeAddBtn.addEventListener('click', () => {
        if (familyAges.length >= FAMILY_MAX) return;
        familyAges.push({ id: newFamilyId(), name: '', year: new Date().getFullYear() - 30, month: null, day: null, primary: familyAges.length === 0 });
        renderFamilyAgesList(); scheduleFamilyAutoSave();
      });
    }
    const langSelect = document.getElementById('appLanguage');

    const holidaysEnabledCb = document.getElementById('holidaysEnabledCb');
    const holidayRegionSelect = document.getElementById('holidayRegionSelect');
    const holidayCustomCountry = document.getElementById('holidayCustomCountry');
    const quoteReligionSelect = document.getElementById('quoteReligionSelect');
    const quotePoetrySelect = document.getElementById('quotePoetrySelect');

    function updateHolidayRegionHint() {
      const hint = document.getElementById('holiday-region-hint');
      if (!hint) return;
      const t = i18nPopup[currentLang] || i18nPopup.en;
      const mode = holidayRegionSelect ? holidayRegionSelect.value : 'auto';
      hint.textContent = mode === 'IR' ? t.holidayHintIran : (mode === 'custom' ? t.holidayHintCustom : t.holidayHintAuto);
    }

    function syncHolidayCustomVisibility() {
      if (!holidayRegionSelect || !holidayCustomCountry) return;
      holidayCustomCountry.style.display = holidayRegionSelect.value === 'custom' ? 'block' : 'none';
    }

    if (holidayRegionSelect) {
      holidayRegionSelect.addEventListener('change', () => {
        syncHolidayCustomVisibility();
        updateHolidayRegionHint();
      });
    }

    chrome.storage.sync.get(['userBirthYear', 'userBirthMonth', 'userBirthDay', 'aiTreeFamilyAges', 'appLanguage'], (data) => {
      if (data.appLanguage) {
        currentLang = data.appLanguage;
        langSelect.value = currentLang;
        // Keep a local mirror for void-tab first paint (router reads local only).
        try { chrome.storage.local.set({ appLanguage: currentLang }); } catch (e) {}
      }
      let list = normalizeFamilyList(data.aiTreeFamilyAges);
      if (!list.length && data.userBirthYear) {
        const y = parseInt(data.userBirthYear, 10);
        if (y) {
          list = [{ id: newFamilyId(), name: familyUiText('meDefault'), year: y,
            month: data.userBirthMonth ? parseInt(data.userBirthMonth, 10) : null,
            day: data.userBirthDay ? parseInt(data.userBirthDay, 10) : null, primary: true }];
        }
      }
      familyAges = list; syncLegacyBirthYear(); applyTranslation(); renderFamilyAgesList();
    });

    chrome.storage.local.get(['showPublicHolidays', 'holidayRegionMode', 'holidayCustomCountry', 'quoteReligionSource', 'quotePoetrySource', 'voiceRecognitionLang'], (data) => {
      if (holidaysEnabledCb) holidaysEnabledCb.checked = data.showPublicHolidays !== undefined ? !!data.showPublicHolidays : true;
      if (holidayRegionSelect) holidayRegionSelect.value = data.holidayRegionMode || 'auto';
      if (holidayCustomCountry) holidayCustomCountry.value = data.holidayCustomCountry || '';
      if (quoteReligionSelect) quoteReligionSelect.value = data.quoteReligionSource || 'islam';
      if (quotePoetrySelect) quotePoetrySelect.value = data.quotePoetrySource || 'rumi';
      if (data.voiceRecognitionLang) {
        chrome.storage.local.remove('voiceRecognitionLang');
      }
      syncHolidayCustomVisibility();
      updateHolidayRegionHint();
    });

    langSelect.addEventListener('change', (e) => {
      currentLang = e.target.value;
      applyTranslation();
    });

    // منوهای «گنجینه» (Vault) روی تب جدایی از دکمهٔ «ذخیره تنظیمات» (که فقط
    // در تب Core است) نشسته‌اند — قبلاً کاربر باید بعد از تعویض این‌دو، به تب
    // Core برمی‌گشت و آن دکمهٔ دوردست را می‌زد، وگرنه فکر می‌کرد چیزی ذخیره
    // نشده. حالا این دو مستقیماً و آنی روی تغییر ذخیره می‌شوند (content.js از
    // قبل chrome.storage.onChanged را برای همین دو کلید گوش می‌دهد، پس اثرش
    // فوری روی صفحهٔ باز هم دیده می‌شود)، به‌اضافهٔ یک تأییدِ کوچکِ همان‌جا.
    let vaultHintTimer = null;
    function flashVaultLiveHint() {
      const hint = document.getElementById('vault-live-hint');
      if (!hint) return;
      hint.textContent = (i18nPopup[currentLang] || i18nPopup.en).vaultLiveSaved;
      hint.classList.add('show');
      if (vaultHintTimer) clearTimeout(vaultHintTimer);
      vaultHintTimer = setTimeout(() => hint.classList.remove('show'), 1800);
    }
    if (quoteReligionSelect) {
      quoteReligionSelect.addEventListener('change', () => {
        chrome.storage.local.set({ quoteReligionSource: quoteReligionSelect.value }, () => {
          flashVaultLiveHint();
          broadcastRefresh();
        });
      });
    }
    if (quotePoetrySelect) {
      quotePoetrySelect.addEventListener('change', () => {
        chrome.storage.local.set({ quotePoetrySource: quotePoetrySelect.value }, () => {
          flashVaultLiveHint();
          broadcastRefresh();
        });
      });
    }

    // اگر همزمان با باز بودن این پاپ‌آپ، کاربر از همان تب‌های کوچکِ سوییچِ منبع
    // که حالا روی خودِ ویجت (آیهٔ روز / شعر روز) اضافه شده استفاده کند، این دو
    // منو هم باید بدون نیاز به بستن‌وبازکردنِ پاپ‌آپ خودشان را به‌روز کنند.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.quoteReligionSource && quoteReligionSelect && document.activeElement !== quoteReligionSelect) {
        quoteReligionSelect.value = changes.quoteReligionSource.newValue || 'islam';
      }
      if (changes.quotePoetrySource && quotePoetrySelect && document.activeElement !== quotePoetrySelect) {
        quotePoetrySelect.value = changes.quotePoetrySource.newValue || 'rumi';
      }
    });

    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
      const newData = {
        appLanguage: langSelect.value,
        userBirthYear: (function () { collectFamilyFromDom(); const prim = primaryMember(); return prim ? prim.year : ''; })(),
        userBirthMonth: (function () { const prim = primaryMember(); return (prim && prim.month) ? prim.month : ''; })(),
        userBirthDay: (function () { const prim = primaryMember(); return (prim && prim.day) ? prim.day : ''; })(),
        aiTreeFamilyAges: familyAges
      };
      chrome.storage.sync.set(newData, () => {
        // Mirror appLanguage to local so void-tab-router can read RTL/LTR on the
        // first paint without waiting for storage.sync (avoids quickbar flip).
        const localData = {
          appLanguage: langSelect.value,
          showPublicHolidays: holidaysEnabledCb ? !!holidaysEnabledCb.checked : false,
          holidayRegionMode: holidayRegionSelect ? holidayRegionSelect.value : 'auto',
          holidayCustomCountry: holidayCustomCountry ? holidayCustomCountry.value.trim().toUpperCase().slice(0, 2) : '',
          quoteReligionSource: quoteReligionSelect ? quoteReligionSelect.value : 'islam',
          quotePoetrySource: quotePoetrySelect ? quotePoetrySelect.value : 'rumi'
        };
        chrome.storage.local.set(localData, () => {
          showToast((i18nPopup[currentLang] || i18nPopup.en).toastSaved);
          broadcastRefresh();
        });
      });
    });

    const hideOnPageBtn = document.getElementById('hideOnPageBtn');
    if (hideOnPageBtn) {
      hideOnPageBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "hideLauncherAnly" }).catch(() => {});
            // ماندگار کردن مخفی‌بودن برای همین دامنه، تا در هر زیرصفحه‌ی دیگرِ همان
            // سایت هم (نه فقط همین تب) تا اطلاع ثانوی مخفی بماند.
            let hostname = '';
            try { hostname = new URL(tabs[0].url).hostname; } catch (e) {}
            if (hostname) {
              chrome.storage.local.get(['aiTreeHiddenDomains'], (res) => {
                const list = Array.isArray(res.aiTreeHiddenDomains) ? res.aiTreeHiddenDomains : [];
                if (!list.includes(hostname)) {
                  list.push(hostname);
                  chrome.storage.local.set({ aiTreeHiddenDomains: list });
                }
              });
            }
            window.close();
          }
        });
      });
    }

    const showOnPageBtn = document.getElementById('showOnPageBtn');
    if (showOnPageBtn) {
      showOnPageBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "resetFloatingMenuPositionAnly" }).catch(() => {});
            let hostname = '';
            try { hostname = new URL(tabs[0].url).hostname; } catch (e) {}
            if (hostname) {
              chrome.storage.local.get(['aiTreeHiddenDomains'], (res) => {
                const list = Array.isArray(res.aiTreeHiddenDomains) ? res.aiTreeHiddenDomains : [];
                const next = list.filter(d => d !== hostname);
                if (next.length !== list.length) chrome.storage.local.set({ aiTreeHiddenDomains: next });
              });
            }
            window.close();
          }
        });
      });
    }

    /* ------------------------------------------------------------------
       Launcher controls (Show/Hide above) exist only on Void Tab.
       Ordinary websites no longer load the AI Orbit Launcher (content.js),
       so these buttons would have no target there. The row starts hidden
       in popup.html and is revealed only when the active tab is Void Tab.
       ------------------------------------------------------------------ */
    function isVoidTabPageUrl(url) {
      if (!url) return false;
      return url.indexOf(chrome.runtime.getURL('void-tab.html')) === 0 || /^chrome:\/\/newtab\/?/i.test(url);
    }
    const launcherControls = document.getElementById('launcherControls');
    if (launcherControls) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || !tabs[0]) return;
        if (isVoidTabPageUrl(tabs[0].url || tabs[0].pendingUrl)) launcherControls.style.display = 'flex';
      });
    }

    /* ------------------------------------------------------------------
       Music Orb on this site — separate from the Launcher controls above.
       Default is hidden; only an explicit per-origin "show" authorizes it.
       ------------------------------------------------------------------ */
    function supportedMusicOrbTab(tab) {
      if (!tab || typeof tab.id !== 'number' || !tab.url) return null;
      let u;
      try { u = new URL(tab.url); } catch (e) { return null; }
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      const h = u.hostname.toLowerCase();
      if (/(^|\.)accounts\.google\.com$/.test(h) || /(^|\.)appleid\.apple\.com$/.test(h) ||
          /(^|\.)login\.microsoftonline\.com$/.test(h) || /(^|\.)login\.live\.com$/.test(h)) return null;
      if (h === 'chromewebstore.google.com') return null;
      if (h === 'chrome.google.com' && u.pathname.indexOf('/webstore') === 0) return null;
      return { id: tab.id, origin: u.origin };
    }

    function renderMusicOrbControl() {
      const mo = musicOrbText();
      const title = document.getElementById('lbl-music-orb-site');
      const stateEl = document.getElementById('musicOrbSiteState');
      const showBtn = document.getElementById('musicOrbSiteShow');
      const hideBtn = document.getElementById('musicOrbSiteHide');
      if (title) title.textContent = mo.title;
      if (showBtn) showBtn.textContent = mo.show;
      if (hideBtn) hideBtn.textContent = mo.hide;
      if (!stateEl || !showBtn || !hideBtn) return;

      let state = mo.unavailable;
      let canShow = false, canHide = false;
      if (!musicOrbSupported || !musicOrbStorageOK || musicOrbMapMalformed) {
        state = mo.unavailable;
      } else if (musicOrbPref === 'show') {
        state = mo.on; canHide = true;
      } else if (musicOrbPref === 'hide' || musicOrbPref === 'unset') {
        state = mo.off; canShow = true;
      } else if (musicOrbPref === 'invalid') {
        state = mo.invalid; canShow = true; canHide = true;
      }
      stateEl.textContent = state;
      showBtn.disabled = musicOrbBusy || !canShow;
      hideBtn.disabled = musicOrbBusy || !canHide;
    }

    function initMusicOrbControl() {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || !tabs[0]) {
          musicOrbSupported = false; musicOrbOrigin = ''; renderMusicOrbControl(); return;
        }
        const site = supportedMusicOrbTab(tabs[0]);
        if (!site) {
          musicOrbSupported = false; musicOrbOrigin = ''; musicOrbTabId = null; renderMusicOrbControl(); return;
        }
        musicOrbTabId = site.id; musicOrbOrigin = site.origin; musicOrbSupported = true;
        chrome.storage.local.get([SITE_DISPLAY_KEY], (res) => {
          if (chrome.runtime.lastError) {
            musicOrbStorageOK = false; musicOrbPref = 'unset'; renderMusicOrbControl(); return;
          }
          res = res || {};
          musicOrbStorageOK = true;
          const v = res[SITE_DISPLAY_KEY];
          if (v === undefined || v === null) {
            musicOrbMapMalformed = false; musicOrbPref = 'unset';
          } else if (typeof v !== 'object' || Array.isArray(v)) {
            musicOrbMapMalformed = true; musicOrbPref = 'invalid';
          } else {
            musicOrbMapMalformed = false;
            if (!Object.prototype.hasOwnProperty.call(v, musicOrbOrigin)) {
              musicOrbPref = 'unset';
            } else {
              const p = v[musicOrbOrigin];
              musicOrbPref = (p === 'show' || p === 'hide') ? p : 'invalid';
            }
          }
          renderMusicOrbControl();
        });
      });
    }

    function setMusicOrbPreference(value) {
      if (!musicOrbSupported || !musicOrbOrigin || musicOrbBusy || (value !== 'show' && value !== 'hide')) return;
      musicOrbBusy = true; renderMusicOrbControl();
      chrome.storage.local.get([SITE_DISPLAY_KEY], (res) => {
        if (chrome.runtime.lastError) {
          musicOrbBusy = false; musicOrbStorageOK = false; renderMusicOrbControl(); return;
        }
        res = res || {};
        const map = res[SITE_DISPLAY_KEY];
        if (map !== undefined && map !== null && (typeof map !== 'object' || Array.isArray(map))) {
          musicOrbBusy = false; musicOrbMapMalformed = true; musicOrbPref = 'invalid'; renderMusicOrbControl(); return;
        }
        const next = {};
        if (map && typeof map === 'object') {
          for (const k in map) if (Object.prototype.hasOwnProperty.call(map, k)) next[k] = map[k];
        }
        next[musicOrbOrigin] = value;
        chrome.storage.local.set({ [SITE_DISPLAY_KEY]: next }, () => {
          musicOrbBusy = false;
          if (chrome.runtime.lastError) {
            musicOrbStorageOK = false; renderMusicOrbControl(); return;
          }
          musicOrbStorageOK = true; musicOrbMapMalformed = false; musicOrbPref = value;
          try {
            chrome.tabs.sendMessage(musicOrbTabId, { type: 'void-display-pref', origin: musicOrbOrigin, value: value }, () => {
              void chrome.runtime.lastError;
            });
          } catch (e) {}
          renderMusicOrbControl();
        });
      });
    }

    const musicOrbShowBtn = document.getElementById('musicOrbSiteShow');
    const musicOrbHideBtn = document.getElementById('musicOrbSiteHide');
    if (musicOrbShowBtn) musicOrbShowBtn.addEventListener('click', () => setMusicOrbPreference('show'));
    if (musicOrbHideBtn) musicOrbHideBtn.addEventListener('click', () => setMusicOrbPreference('hide'));
    initMusicOrbControl();

    /* ------------------------------------------------------------------
       Launcher on websites — one dropdown decides where the launcher exists:
         off (default) · all sites · chosen sites only.
       On an ordinary website a single button adds/removes just that site
       (in "all" mode it manages exceptions; while "off" it switches to
       "chosen sites"). State shown here is only what background.js confirmed.
       Separate from the Music Orb control and from the Void Tab buttons.
       ------------------------------------------------------------------ */
    var launcherI18n = {
      en: { title: 'Launcher on websites', off: 'Hidden on all sites (default)', all: 'Show on all sites', selected: 'Show only on chosen sites',
            hintOff: 'Nothing is loaded on websites. Void Tab is not affected.', hintAll: 'Shown on every website. You can hide it on single sites below.', hintSelected: 'Shown only on sites you chose',
            n: ' — chosen: ', ex: ' — hidden on: ',
            on: 'Shown on this site', offHere: 'Hidden on this site', show: 'Show on this site', hide: 'Hide on this site', showAuto: 'Show on this site (switches to chosen sites)',
            failed: 'Could not apply it — reload the page and try again', pending: 'Will appear when the page finishes loading' },
      fa: { title: 'لانچر در وب‌سایت‌ها', off: 'پنهان در همهٔ سایت‌ها (پیش‌فرض)', all: 'نمایش در همهٔ سایت‌ها', selected: 'نمایش فقط در سایت‌های انتخابی',
            hintOff: 'هیچ‌چیز روی وب‌سایت‌ها بارگذاری نمی‌شود. Void Tab بی‌تأثیر است.', hintAll: 'در همهٔ وب‌سایت‌ها نمایش داده می‌شود. می‌توانید در هر سایت جداگانه پنهانش کنید.', hintSelected: 'فقط در سایت‌هایی که انتخاب کرده‌اید نمایش داده می‌شود',
            n: ' — تعداد انتخابی: ', ex: ' — پنهان در: ',
            on: 'در این سایت نمایش داده می‌شود', offHere: 'در این سایت پنهان است', show: 'نمایش در این سایت', hide: 'پنهان در این سایت', showAuto: 'نمایش در این سایت (حالت «سایت‌های انتخابی» فعال می‌شود)',
            failed: 'اعمال نشد — صفحه را رفرش کنید و دوباره تلاش کنید', pending: 'پس از پایان بارگذاری صفحه نمایش داده می‌شود' }
    };
    var launcherSt = null, launcherTabId = null, launcherHost = '', launcherBusy = false, launcherMsg = '';
    function renderLauncherSiteControl() {
      const sel = document.getElementById('launcherModeSelect');
      if (!sel || !launcherI18n) return;
      const tx = launcherI18n[currentLang] || launcherI18n.en;
      const title = document.getElementById('lbl-launcher-mode');
      const hint = document.getElementById('launcherModeHint');
      const row = document.getElementById('launcherSiteRow');
      const state = document.getElementById('launcherSiteState');
      const btn = document.getElementById('launcherSiteToggle');
      if (title) title.textContent = tx.title;
      Array.prototype.forEach.call(sel.options, (o) => { if (tx[o.value]) o.textContent = tx[o.value]; });
      if (!launcherSt) { sel.disabled = true; if (hint) hint.textContent = ''; if (row) row.style.display = 'none'; return; }
      sel.value = launcherSt.mode; sel.disabled = launcherBusy;
      if (hint) {
        const base = launcherSt.mode === 'all' ? tx.hintAll : (launcherSt.mode === 'selected' ? tx.hintSelected : tx.hintOff);
        const extra = launcherSt.mode === 'selected' ? (tx.n + launcherSt.sites) : (launcherSt.mode === 'all' && launcherSt.excluded ? (tx.ex + launcherSt.excluded) : '');
        hint.textContent = base + extra;
      }
      if (row) row.style.display = (launcherSt.supported && launcherTabId != null) ? 'block' : 'none';
      if (state) state.textContent = launcherMsg || (launcherSt.siteOn ? tx.on : tx.offHere);
      if (btn) {
        btn.textContent = launcherSt.siteOn ? tx.hide : (launcherSt.mode === 'off' ? tx.showAuto : tx.show);
        btn.disabled = launcherBusy;
      }
    }
    function launcherSend(payload, done) {
      launcherBusy = true; launcherMsg = ''; renderLauncherSiteControl();
      const tx = launcherI18n[currentLang] || launcherI18n.en;
      let finished = false;
      const watchdog = setTimeout(() => {   // never leave the controls stuck in the busy state
        if (finished) return; finished = true; launcherBusy = false; launcherMsg = tx.failed; renderLauncherSiteControl();
      }, 12000);
      chrome.runtime.sendMessage(Object.assign({ type: 'vm-launcher-site', tabId: launcherTabId }, payload), (res) => {
        if (finished) return; finished = true; clearTimeout(watchdog);
        launcherBusy = false;
        if (chrome.runtime.lastError || !res || !res.ok) { launcherMsg = tx.failed; }
        else { launcherSt = res; launcherMsg = res.pending ? tx.pending : (res.warn ? tx.failed : ''); }
        renderLauncherSiteControl();
        if (done) done(res);
      });
    }
    function initLauncherSiteControl() {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const t = (!chrome.runtime.lastError && tabs && tabs[0]) ? tabs[0] : null;
        const site = t ? supportedMusicOrbTab(t) : null;
        launcherTabId = site ? site.id : null;
        try { launcherHost = site ? new URL(t.url).hostname : ''; } catch (e) { launcherHost = ''; }
        chrome.runtime.sendMessage({ type: 'vm-launcher-site', op: 'status', tabId: launcherTabId }, (res) => {
          if (chrome.runtime.lastError || !res || !res.ok) return;   // cannot control it: the dropdown stays disabled
          launcherSt = res; renderLauncherSiteControl();
        });
      });
    }
    const launcherModeSelect = document.getElementById('launcherModeSelect');
    if (launcherModeSelect) launcherModeSelect.addEventListener('change', () => launcherSend({ op: 'setMode', mode: launcherModeSelect.value }, (res) => {
      if (!res || !res.ok) initLauncherSiteControl();   // re-read the real state if it failed
    }));
    const launcherSiteToggle = document.getElementById('launcherSiteToggle');
    if (launcherSiteToggle) launcherSiteToggle.addEventListener('click', () => {
      if (!launcherSt || launcherBusy) return;
      const turnOn = !launcherSt.siteOn;
      const go = () => launcherSend({ op: 'toggleSite', on: turnOn });
      if (turnOn && launcherHost) {
        // The old "Hide" deny-list must not keep the launcher hidden on a site the user now shows.
        chrome.storage.local.get(['aiTreeHiddenDomains'], (r) => {
          const list = Array.isArray(r && r.aiTreeHiddenDomains) ? r.aiTreeHiddenDomains : [];
          const next = list.filter(d => d !== launcherHost);
          if (next.length !== list.length) chrome.storage.local.set({ aiTreeHiddenDomains: next }, go); else go();
        });
      } else { go(); }
    });
    initLauncherSiteControl();

    // «بازگردانی صفحهٔ خانه به پیش‌فرض» — دکمهٔ قبلیِ «باز کردن تب وید»
    // دیگر لازم نیست (چون حالا هم با override صفحهٔ تب جدید، هم با کپی‌لینکِ
    // پایین، این صفحه در دسترسه)؛ این دکمه به‌جایش کاربر رو راهنمایی می‌کنه
    // که چطور تنظیم صفحهٔ خانه رو به‌حالت پیش‌فرضِ خودِ کروم (باز کردن صفحهٔ
    // تب جدید) برگردونه — چون این هم مثل تنظیمِ اولیه، هیچ API خودکاری نداره
    // و فقط از طریق تنظیمات خودِ کروم قابل انجامه. (chrome.tabs.create روی
    // آدرس‌های chrome://settings/* از داخل popup قابل‌اعتماد نیست — همیشه یا
    // در همهٔ نسخه‌ها تضمینی کار نمی‌کند — پس عمداً به‌جای تلاش برای navigate
    // کردن، فقط مسیر دقیق را متنی نشان می‌دهیم؛ همان الگوی امنِ کپی‌لینک زیرش)
    // «تب وید» — دقیقاً مثل قبل، حداکثر یک نمونه از این تب هم‌زمان باز می‌ماند:
    // اگر از قبل باز است، فقط فوکوسش می‌کنیم؛ وگرنه یک تبِ تازه می‌سازیم. پارامترِ
    // ?explicit=1 به void-tab-router.js می‌گوید که این باز شدن، درخواستِ صریحِ
    // خودِ کاربر از همین دکمه بوده — حتی اگر «ریدایرکت به موتور جستجوی استاندارد»
    // را هم روشن کرده باشد، این تبِ صریحاً درخواست‌شده هرگز نباید ریدایرکت شود.
    const createVoidTabBtn = document.getElementById('createVoidTabBtn');
    if (createVoidTabBtn) {
      createVoidTabBtn.addEventListener('click', () => {
        const voidTabUrl = chrome.runtime.getURL('void-tab.html');
        // انتخابِ صریحِ «تب وید» یعنی کاربر دوباره حالتِ وید را می‌خواهد؛ پس
        // تیکِ «ریدایرکت به موتور جستجوی استاندارد» باید هم در UI و هم در
        // storage برداشته شود (وگرنه با باز کردن دوبارهٔ پاپ‌آپ، تیک برمی‌گردد).
        // قبل از بستنِ پاپ‌آپ صبر می‌کنیم تا نوشتنِ storage کامل شود.
        const cb = document.getElementById('useDefaultNtpCb');
        if (cb) cb.checked = false;
        chrome.storage.local.set({ useDefaultNtp: false }, () => {
          chrome.tabs.query({}, (tabs) => {
            const existingTab = tabs.find(t => t.url && t.url.indexOf(voidTabUrl) === 0);
            if (existingTab) {
              const focusRequests = [chrome.tabs.update(existingTab.id, { active: true }).catch(() => {})];
              if (existingTab.windowId) focusRequests.push(chrome.windows.update(existingTab.windowId, { focused: true }).catch(() => {}));
              Promise.all(focusRequests).finally(() => window.close());
              return;
            } else {
              chrome.tabs.create({ url: voidTabUrl + '?explicit=1' });
            }
            window.close();
          });
        });
      });
    }

    // «رفتار تب جدید» — چون chrome_url_overrides.newtab در manifest.json ثابت
    // است و هیچ API ای برای روشن/خاموش‌کردنِ آن در زمانِ اجرا وجود ندارد، این
    // تنظیم به‌جایش به void-tab.html می‌گوید که خودش را نشان بدهد یا کاربر را
    // به موتور جستجوی استاندارد هدایت کند (رجوع به void-tab-router.js).
    const useDefaultNtpCb = document.getElementById('useDefaultNtpCb');
    if (useDefaultNtpCb) {
      chrome.storage.local.get(['useDefaultNtp'], (data) => {
        useDefaultNtpCb.checked = !!data.useDefaultNtp;
      });
      useDefaultNtpCb.addEventListener('change', () => {
        const enabled = useDefaultNtpCb.checked;
        const tp = i18nPopup[currentLang] || i18nPopup.en;
        chrome.storage.local.set({ useDefaultNtp: enabled }, () => {
          showToast(enabled ? (tp.toastNtpDefaultOn || 'Standard New Tab enabled') : (tp.toastNtpDefaultOff || 'Void Galaxy New Tab restored'));
        });
      });
    }

    const PROMPT_KEYS = {
      custom: 'aiTreeCustomPrompts',
      overrides: 'aiTreePromptOverrides',
      hidden: 'aiTreePromptHidden',
      history: 'aiTreePromptHistory'
    };

    const STORAGE_KEYS = {
      local: [
        'linksData', 'linksData2', 'linksData3', 'linksData4',
        PROMPT_KEYS.custom, PROMPT_KEYS.overrides, PROMPT_KEYS.hidden, PROMPT_KEYS.history,
        'aiTreeTimeEvents',
        'aiTreeEmojiMemory', 'aiTreeNotepadHistory',
        'showPublicHolidays', 'holidayRegionMode', 'holidayCustomCountry',
        'quoteReligionSource', 'quotePoetrySource',
        'noteTextAlign', 'noteFontSize',
        'activeNoteAIIndex',
        'webSearchEngine', 'webSearchEngineOverrides', 'webSearchCustomEngines',
        'voidPinnedLinks', 'voidHiddenAutoLinks'
      ],
      sync: [
        'aiTreeTodos', 'aiTreeMarkedDays',
        'appLanguage', 'userBirthYear', 'userBirthMonth', 'userBirthDay', 'aiTreeFamilyAges', 'nodeSpacing',
        'clockCustomX', 'clockCustomY', 'orbitX', 'orbitY',
        'coreAIConfig'
      ]
    };

    function pad2(n) { return String(n).padStart(2, '0'); }

    document.getElementById('exportJsonBtn').addEventListener('click', () => {
      chrome.storage.local.get(STORAGE_KEYS.local, (localData) => {
        chrome.storage.sync.get(STORAGE_KEYS.sync, (syncData) => {
          const payload = {
            version: 4,
            exportedAt: new Date().toISOString(),
            local: localData,
            sync: syncData
          };

          const now = new Date();
          const dateStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
          const timeStr = `${pad2(now.getHours())}-${pad2(now.getMinutes())}-${pad2(now.getSeconds())}`;
          const filename = `AITree_Backup_${dateStr}_${timeStr}.json`;

          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} try { a.remove(); } catch (e) {} }, 1500);
          showToast((i18nPopup[currentLang] || i18nPopup.en).toastExported);
        });
      });
    });

    const fileInput = document.getElementById('fileInput');
    document.getElementById('importJsonBtn').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      const t = i18nPopup[currentLang] || i18nPopup.en;
      reader.onload = (event) => {
        try {
          const importedData = JSON.parse(event.target.result);
          let localUpdates = null;
          let syncUpdates = {};

          if (importedData && importedData.version >= 4 && importedData.local && typeof importedData.local === 'object') {
            localUpdates = importedData.local;
            syncUpdates = (importedData.sync && typeof importedData.sync === 'object') ? importedData.sync : {};
          } else if (Array.isArray(importedData)) {
            localUpdates = { linksData: importedData };
          } else if (importedData && Array.isArray(importedData.main)) {
            localUpdates = { linksData: importedData.main };
            if (Array.isArray(importedData.w2)) localUpdates.linksData2 = importedData.w2;
            if (Array.isArray(importedData.w3)) localUpdates.linksData3 = importedData.w3;
            if (Array.isArray(importedData.w4)) localUpdates.linksData4 = importedData.w4;
            else if (Array.isArray(importedData.news)) localUpdates.linksData4 = importedData.news;

            const p = importedData.prompts;
            if (p && typeof p === 'object') {
              if (Array.isArray(p.custom)) {
                localUpdates[PROMPT_KEYS.custom] = p.custom
                  .filter(item => item && typeof item.title === 'string' && typeof item.text === 'string')
                  .slice(0, 300)
                  .map(item => ({
                    id: item.id || ('c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
                    title: String(item.title).slice(0, 40),
                    text: String(item.text),
                    category: typeof item.category === 'string' ? item.category : 'general'
                  }));
              }
              if (p.overrides && typeof p.overrides === 'object' && !Array.isArray(p.overrides)) {
                localUpdates[PROMPT_KEYS.overrides] = p.overrides;
              }
              if (Array.isArray(p.hidden)) {
                localUpdates[PROMPT_KEYS.hidden] = p.hidden.filter(id => typeof id === 'string');
              }
              if (Array.isArray(p.history)) {
                localUpdates[PROMPT_KEYS.history] = p.history
                  .filter(h => h && typeof h.text === 'string')
                  .slice(0, 10)
                  .map(h => ({ ts: typeof h.ts === 'number' ? h.ts : Date.now(), text: String(h.text) }));
              }
            }
          }

          if (!localUpdates) { alert(t.invalidFile); return; }

          chrome.storage.local.set(localUpdates, () => {
            const finalize = () => {
              showToast(t.toastImported);
              broadcastRefresh();
              fileInput.value = '';
            };
            if (Object.keys(syncUpdates).length > 0) {
              chrome.storage.sync.set(syncUpdates, finalize);
            } else {
              finalize();
            }
          });
        } catch (err) { alert(t.errRead); }
      };
      reader.readAsText(file);
    });


    // ---- Iran holidays JSON (save / load / clear custom) ----
    function downloadTextFile(filename, text, mime) {
      try {
        const blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try { URL.revokeObjectURL(url); } catch (e) {}
          try { a.remove(); } catch (e) {}
        }, 1500);
        return true;
      } catch (err) {
        console.error('[AI Tree] download failed', err);
        return false;
      }
    }

    const iranExportBtn = document.getElementById('exportIranHolidaysBtn');
    const iranImportBtn = document.getElementById('importIranHolidaysBtn');
    const iranResetBtn = document.getElementById('resetIranHolidaysBtn');
    const iranFileInput = document.getElementById('iranHolidaysFileInput');
    const iranStatus = document.getElementById('iran-holidays-status');

    function setIranStatus(msg) {
      if (iranStatus) iranStatus.textContent = msg || '';
    }

    function updateIranResetButton(hasOverride) {
      if (!iranResetBtn) return;
      if (hasOverride) {
        iranResetBtn.disabled = false;
        iranResetBtn.style.opacity = '1';
        iranResetBtn.style.color = '#cbd5e1';
      } else {
        iranResetBtn.disabled = true;
        iranResetBtn.style.opacity = '0.55';
        iranResetBtn.style.color = '#94a3b8';
      }
    }

    function refreshIranHolidaysStatus() {
      chrome.runtime.sendMessage({ action: 'getIranHolidays' }, (res) => {
        if (chrome.runtime.lastError) {
          setIranStatus('خطا در ارتباط با افزونه');
          updateIranResetButton(false);
          return;
        }
        if (!res || !res.success) {
          setIranStatus('');
          updateIranResetButton(false);
          return;
        }
        const n = Array.isArray(res.data) ? res.data.length : 0;
        const isCustom = res.source === 'iran-override';
        const srcLabel = isCustom
          ? 'فایل سفارشی شما'
          : (res.source === 'iran-json' ? 'فایل اصلی افزونه' : 'فهرست داخلی');
        setIranStatus(n + ' مناسبت · منبع: ' + srcLabel);
        updateIranResetButton(isCustom);
      });
    }
    refreshIranHolidaysStatus();

    if (iranExportBtn) {
      iranExportBtn.addEventListener('click', () => {
        // 1) Try background
        chrome.runtime.sendMessage({ action: 'getIranHolidays' }, (res) => {
          let events = null;
          let source = 'export';
          if (!chrome.runtime.lastError && res && res.success && Array.isArray(res.data) && res.data.length) {
            events = res.data;
            source = res.source || 'export';
            finishExport(events, source);
            return;
          }
          // 2) Fallback: fetch packaged JSON directly from extension
          fetch(chrome.runtime.getURL('iran-holidays.json'))
            .then((r) => r.json())
            .then((doc) => {
              const list = (doc && (doc.events || doc.holidays)) || (Array.isArray(doc) ? doc : null);
              if (!list || !list.length) throw new Error('empty');
              finishExport(list, 'iran-json');
            })
            .catch(() => {
              alert('نتوانست فهرست مناسبت‌ها را بخواند. مطمئن شوید iran-holidays.json کنار افزونه است و افزونه را Reload کرده‌اید.');
            });
        });

        function finishExport(events, source) {
          const doc = {
            version: 1,
            region: 'IR',
            title: 'مناسبت‌ها و تعطیلات رسمی ایران',
            updated: new Date().toISOString().slice(0, 10),
            source: source,
            events: events
          };
          const text = JSON.stringify(doc, null, 2);
          const name = 'iran-holidays-' + doc.updated + '.json';
          const ok = downloadTextFile(name, text, 'application/json;charset=utf-8');
          if (ok) showToast('فایل «' + name + '» ذخیره شد');
          else alert('دانلود ناموفق بود');
        }
      });
    }

    if (iranImportBtn && iranFileInput) {
      iranImportBtn.addEventListener('click', () => iranFileInput.click());
      iranFileInput.addEventListener('change', () => {
        const file = iranFileInput.files && iranFileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(String(reader.result || ''));
            const events = Array.isArray(parsed)
              ? parsed
              : (parsed.events || parsed.holidays || null);
            if (!Array.isArray(events) || events.length === 0) {
              alert('فایل معتبر نیست.\nباید یک آرایه باشد یا فیلد events داشته باشد.');
              iranFileInput.value = '';
              return;
            }
            chrome.runtime.sendMessage({ action: 'setIranHolidays', data: events }, (res) => {
              if (chrome.runtime.lastError || !res || !res.success) {
                alert('بارگذاری ناموفق. هر آیتم باید day، month و label داشته باشد.');
                return;
              }
              showToast((res.count || events.length) + ' مناسبت بارگذاری شد');
              refreshIranHolidaysStatus();
              broadcastRefresh();
            });
          } catch (err) {
            alert('خواندن JSON ناموفق بود — فایل را بررسی کنید.');
          }
          iranFileInput.value = '';
        };
        reader.readAsText(file, 'UTF-8');
      });
    }

    if (iranResetBtn) {
      iranResetBtn.addEventListener('click', () => {
        if (iranResetBtn.disabled) return;
        if (!confirm('فایل سفارشی حذف شود و دوباره از فهرست اصلی افزونه استفاده شود؟')) return;
        chrome.runtime.sendMessage({ action: 'resetIranHolidays' }, (res) => {
          if (chrome.runtime.lastError || !res || !res.success) {
            alert('حذف تغییرات ناموفق بود');
            return;
          }
          showToast('به فهرست اصلی افزونه برگشت');
          refreshIranHolidaysStatus();
          broadcastRefresh();
        });
      });
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2500);
    }

    function broadcastRefresh() {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: "refreshSpiralUI" }).catch(() => {});
        });
      });
    }
});
