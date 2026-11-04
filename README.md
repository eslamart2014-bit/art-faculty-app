# 🎨 نظام إدارة قسم التربية الفنية — دليل هيكلية ومحاور النظام

تم تنظيم وهيكلة هذا المشروع وفق **محاور النظام الوظيفية (Domain-Driven Modular Architecture)** بأسماء واضحة وبسيطة، بحيث يمكن الدخول لأي جزء وتطويره أو تعديله مباشرة دون الحاجة لقراءة النظام بالكامل.

---

## 🧭 الفهرس السريع لمحاور النظام (System Axes)

عند طلب تعديل في أي محور من المحاور التالية، توجه مباشرة للمسار المخصص له:

| # | المحور (الاسم المختصر للطلب) | شاشات العرض (`src/app`) | المكونات (`src/components`) | المكتبات والخدمات (`src/lib`) | مسارات الـ API (`src/app/api`) |
|---|---|---|---|---|---|
| **1** | **محور الإدارة العامة**<br>*(لوحة المالك والمدير)* | `src/app/(admin)/admin/`<br>`src/app/page.tsx` | `src/components/admin/` | `src/lib/admin/` | `src/app/api/admin/` |
| **2** | **محور بوابة القنوات والأرشيف والمقترحات**<br>*(Portal Hub)* | — *(مدمج بلوحة الإدارة وبوابات العرض)* | `src/components/portal-hub/` | — | `src/app/api/portal/`<br>`src/app/api/archives/`<br>`src/app/api/suggestions/` |
| **3** | **محور المقررات الدراسية**<br>*(السكاشن، الغياب، المشاريع، التقارير، الرفع)* | `src/app/(courses)/course/[id]/` | `src/components/courses/` | `src/lib/courses/` | `src/app/api/courses/`<br>`src/app/api/attendance/`<br>`src/app/api/projects/`<br>`src/app/api/warnings/` |
| **4** | **محور أعضاء هيئة التدريس**<br>*(بوابة الدكتور / الهيئة المعاونة)* | `src/app/(instructors)/instructor/` | `src/components/courses/` | `src/lib/courses/` | `src/app/api/instructor/` |
| **5** | **محور المنسقين والليدر**<br>*(بوابة المنسقين والماسح السريع)* | `src/app/(coordinators)/coordinator/`<br>`src/app/(coordinators)/scanner/` | `src/components/scanner/` | — | `src/app/api/share/` |
| **6** | **محور بوابة الطالب**<br>*(التسجيل، المشاريع، الغياب، الإنذارات، الكاميرا، الـ QR)* | `src/app/(students)/system/`<br>`src/app/(students)/student-portal/`<br>`src/app/(students)/verify/` | `src/components/students/` | `src/lib/students/` | `src/app/api/student/`<br>`src/app/api/students/` |
| **7** | **محور خزائن الطلاب (الدواليب)**<br>*(حجز وإدارة الخزائن)* | — *(تبويب بالإدارة وتبويب ببوابة الطالب)* | `src/components/lockers/` | `src/lib/lockers/` | `src/app/api/lockers/` |
| **8** | **محور المصادقة والأمان وبصمة الجهاز**<br>*(Auth & Security)* | — | `src/components/auth/` | `src/lib/auth/` | `src/app/api/auth/` |
| **9** | **محور البوت والإشعارات**<br>*(تيليجرام + إشعارات الموبايل FCM)* | `src/app/(telegram)/telegram-panel/` | `src/components/pwa/` | `src/lib/telegram/` | `src/app/api/telegram/`<br>`src/app/api/notifications/` |
| **10** | **محور النواة وقاعدة البيانات**<br>*(Core & Database)* | `src/app/layout.tsx` | `src/components/layout/` | `src/lib/core/` | `database/` |

---

## 📂 تفصيل الملفات داخل كل محور

### 1️⃣ محور الإدارة العامة (`admin`)
* **الشاشة الرئيسية للإدارة:** `src/app/(admin)/admin/page.tsx`
* **شاشة الهبوط وبوابة الدخول:** `src/app/page.tsx`
* **المكونات (`src/components/admin/`):**
  * `InstructorsSettingsTab.tsx`: إدارة الدكاترة والهيئة المعاونة وصلاحياتهم.
  * `StudentsDatabaseTab.tsx`: قاعدة بيانات الطلاب الموحدة وتعديل بياناتهم وأجهزتهم.
  * `StudentDirectoryModal.tsx`: نافذة دليل وبحث الطلاب.
* **الخدمات (`src/lib/admin/`):**
  * `auditLogger.ts`: سجل العمليات الإدارية (Audit Log).
  * `notificationService.ts`: خدمة إرسال الإشعارات الفورية للطلاب (Firebase FCM).

---

### 2️⃣ محور بوابة القنوات والأرشيف والمقترحات (`portal-hub`)
* **المكونات (`src/components/portal-hub/`):**
  * `AdminPortalHubTab.tsx`: إدارة القنوات الرسمية (تيليجرام/واتساب) وإحصائيات النقرات.
  * `AdminArchivesTab.tsx`: إدارة الأرشيف الأكاديمي والملفات المرجعية.
  * `AdminSuggestionsTab.tsx`: صندوق مقترحات وشكاوى الطلاب للإدارة.
  * `PortalModals.tsx`: النوافذ المنبثقة للبوابة والأرشيف والمقترحات للطلاب.

---

### 3️⃣ محور المقررات الدراسية (`courses`)
* **الشاشات (`src/app/(courses)/course/[id]/`):**
  * `page.tsx`: لوحة تحكم المقرر (السكاشن، الغياب، الإنذارات، المشاريع، الروابط).
  * `projects/page.tsx`: إدارة وتقييم مشاريع المقرر (المرحلة الأولى والمرحلة النهائية).
  * `reports/page.tsx`: التقارير الإحصائية وكشوف المقرر.
  * `upload/page.tsx`: شاشة رفع الأعمال الفنية للمقرر.
* **المكونات (`src/components/courses/`):**
  * `CourseCard.tsx`: كارت المقرر الدراسي.
  * `CourseStudentsDirectoryModal.tsx`: دليل طلاب المقرر.
  * `UploadClient.tsx`: واجهة رفع وتصوير الأعمال داخل المقرر.
* **الخدمات (`src/lib/courses/`):**
  * `courseStore.ts`: إدارة بيانات المقررات محلياً ومع الخادم.
  * `exportHelper.ts`: تصدير كشوف الغياب والتقارير (Excel / PDF / CSV).

---

### 4️⃣ محور أعضاء هيئة التدريس (`instructors`)
* **الشاشات (`src/app/(instructors)/instructor/`):**
  * `page.tsx`: بوابة عضو هيئة التدريس وعرض المقررات المسندة له.
  * `[token]/page.tsx`: الدخول السريع عبر الرابط المخصص للدكتور/المعيد.

---

### 5️⃣ محور المنسقين والماسح الضوئي (`coordinators` & `scanner`)
* **الشاشات (`src/app/(coordinators)/`):**
  * `coordinator/[token]/page.tsx`: بوابة منسق المقرر أو ليدر الدفعة.
  * `scanner/[token]/page.tsx`: شاشة مسح الـ QR السريع لتسجيل حضور الطلاب.
* **المكونات (`src/components/scanner/`):**
  * `QRScannerModal.tsx`: مكون الكاميرا الماسحة لـ QR الكارنيهات.

---

### 6️⃣ محور بوابة الطالب (`students`) — *مُقسّم بالكامل إلى وحدات مستقلة*
* **الشاشات (`src/app/(students)/`):**
  * `system/page.tsx`: المتحكم الرئيسي ببوابة الطالب والجلسة وحالات الاتصال.
  * `student-portal/[token]/page.tsx`: بوابة الطالب عبر الرابط المشترك.
  * `verify/[code]/page.tsx`: صفحة التحقق من صحة الكارنيه الرقمي للطالب.
* **مكونات بوابة الطالب المقسمة (`src/components/students/`):**
  * `StudentAuthView.tsx`: شاشة تسجيل طالب جديد أو تسجيل الدخول بالـ PIN أو إثبات الهوية.
  * `StudentPendingView.tsx`: شاشة انتظار تفعيل ومراجعة الحساب من الإدارة.
  * `StudentProjectsTab.tsx`: تبويب المشاريع والتقييمات (المشاريع المطلوبة، المسلمة، الدرجات، الملاحظات الصوتية/النصية).
  * `StudentAttendanceTab.tsx`: تبويب سجل الحضور والغياب التفصيلي لكل مقرر.
  * `StudentWarningsTab.tsx`: تبويب الإنذارات الأكاديمية وتنبيهات الغياب.
  * `StudentArtworkCameraModal.tsx`: الكاميرا الذكية المخصصة لتصوير ورفع مشاريع الطالب (مع ميزان الهاتف والإضاءة).
  * `StudentSelfieModal.tsx`: كاميرا السيلفي لتوثيق صورة البروفايل الرسمية والكارنيه.
  * `StudentQrModal.tsx`: نافذة عرض وتحميل الكارنيه الجامعي الرقمي (`QR Card`).
  * `StudentMigrationNotice.tsx`: إشعار توجيه الطلاب لتطبيق الأندرويد.
* **الخدمات (`src/lib/students/`):**
  * `codeHelper.ts`: تنسيق والتحقق من أكواد الطلاب والباركود.
  * `imageCompressor.ts`: ضغط وتحويل الصور إلى `WebP` قبل الرفع.
  * `qrCardDownloader.ts`: توليد وتحميل تصميم الكارنيه الجامعي كصورة.

---

### 7️⃣ محور خزائن الطلاب — الدواليب (`lockers`)
* **المكونات (`src/components/lockers/`):**
  * `AdminLockersTab.tsx`: لوحة إدارة الخزائن والدواليب، التسكين، الإخلاء، والطباعة.
  * `StudentLockerTab.tsx`: تبويب حجز وعرض الدولاب الخاص بالطالب داخل بوابة الطالب.
* **الخدمات (`src/lib/lockers/`):**
  * `lockersService.ts`: منطق حجز الدواليب، التحقق من السعة، والتعامل مع قاعدة البيانات.

---

### 8️⃣ محور المصادقة والأمان (`auth`)
* **المكونات (`src/components/auth/`):**
  * `InAppBrowserGuard.tsx`: حماية النظام من المتصفحات المدمجة (مثل متصفح فيسبوك/تليجرام الداخلي).
* **الخدمات (`src/lib/auth/`):**
  * `apiAuth.ts`: التحقق من الجلسات، التوكنات، وصلاحيات الـ API.
  * `deviceFingerprint.ts`: توليد بصمة الجهاز الفريدة والتعرف على نوع الجهاز (Android App / PWA / iOS).
  * `rateLimiter.ts`: حماية مسارات الـ API من الطلبات المتكررة (Rate Limiting).

---

### 9️⃣ محور البوت والإشعارات وتطبيق الويب (`telegram` & `pwa`)
* **الشاشات (`src/app/(telegram)/telegram-panel/`):**
  * `page.tsx`: لوحة تحكم وإدارة بوت التيليجرام.
* **المكونات (`src/components/pwa/`):**
  * `PWAInstallBanner.tsx`: شريط تثبيت التطبيق على الهاتف.
  * `ServiceWorkerRegistration.tsx`: تسجيل الـ Service Worker والـ Web Push.
* **الخدمات (`src/lib/telegram/`):**
  * `botService.ts`: منطق محادثات وأوامر بوت التيليجرام.
  * `telegramLogger.ts`: إرسال إشعارات وسجلات العمليات إلى قناة/بوت التيليجرام.

---

### 🔟 محور النواة وقاعدة البيانات (`core` & `database`)
* **الخدمات الأساسية (`src/lib/core/`):**
  * `supabaseClient.ts`: الاتصال بقاعدة بيانات Supabase (Client & Admin Service Role).
  * `googleDrive.ts`: رفع وإدارة الملفات والصور على Google Drive.
  * `imageUrl.ts`: معالجة روابط الصور المصغرة وعالية الدقة.
* **ملفات قاعدة البيانات المنظمة (`database/`):**
  * `database/schema/`:
    * `01_core_tables.sql`: البنية الكاملة للجداول الأساسية.
    * `02_system_settings.sql`: جدول إعدادات النظام.
    * `03_invitations_and_verify.sql`: جدول الدعوات وصلاحيات التحقق.
    * `04_shares_and_last_seen.sql`: جدول روابط المشاركة وآخر ظهور.
    * `05_lockers_tables.sql`: جداول نظام الخزائن (الدواليب).
    * `06_archives_and_suggestions.sql`: جداول الأرشيف والمقترحات.
    * `07_portal_analytics.sql`: جداول إحصائيات بوابة القنوات.
  * `database/security/`:
    * `01_rls_lockdown.sql`: تفعيل سياسات الحماية الصارمة (RLS).
    * `02_security_hardening.sql`: تحصين الجداول الحساسة.
    * `03_emergency_revert_rls.sql`: ملف طوارئ لإيقاف RLS عند الصيانة.
  * `database/triggers/`:
    * `01_push_triggers.sql`: مشغلات (Triggers) الإشعارات التلقائية.
    * `02_clean_triggers.sql`: تنظيف وإعادة ضبط المشغلات.
* **تطبيق الأندرويد (`android-student/`):**
  * مشروع Android Studio الخاص بتطبيق الطالب (WebView + FCM Push Notifications).
