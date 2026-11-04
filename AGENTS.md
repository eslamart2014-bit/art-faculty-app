<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## System Axes & Modular Directory Map (محاور النظام)

When the user requests changes to a specific axis (محور), navigate directly to the corresponding files without scanning the entire codebase:

1. **محور الإدارة العامة (Admin & Owner Dashboard)**
   - Pages: `src/app/(admin)/admin/page.tsx`, `src/app/page.tsx`
   - Components: `src/components/admin/` (`InstructorsSettingsTab.tsx`, `StudentsDatabaseTab.tsx`, `StudentDirectoryModal.tsx`)
   - Lib: `src/lib/admin/` (`auditLogger.ts`, `notificationService.ts`)
   - API: `src/app/api/admin/`

2. **محور بوابة القنوات والأرشيف والمقترحات (Portal Hub, Archives & Suggestions)**
   - Components: `src/components/portal-hub/` (`AdminPortalHubTab.tsx`, `AdminArchivesTab.tsx`, `AdminSuggestionsTab.tsx`, `PortalModals.tsx`)
   - API: `src/app/api/portal/`, `src/app/api/archives/`, `src/app/api/suggestions/`

3. **محور المقررات الدراسية (Courses, Attendance, Projects, Reports, Upload)**
   - Pages: `src/app/(courses)/course/[id]/` (`page.tsx`, `projects/page.tsx`, `reports/page.tsx`, `upload/page.tsx`)
   - Components: `src/components/courses/` (`CourseCard.tsx`, `CourseStudentsDirectoryModal.tsx`, `UploadClient.tsx`)
   - Lib: `src/lib/courses/` (`courseStore.ts`, `exportHelper.ts`)
   - API: `src/app/api/courses/`, `src/app/api/attendance/`, `src/app/api/projects/`, `src/app/api/warnings/`

4. **محور أعضاء هيئة التدريس (Instructors Portal)**
   - Pages: `src/app/(instructors)/instructor/` (`page.tsx`, `[token]/page.tsx`)
   - API: `src/app/api/instructor/`

5. **محور المنسقين والماسح الضوئي (Coordinators & QR Scanner)**
   - Pages: `src/app/(coordinators)/coordinator/[token]/page.tsx`, `src/app/(coordinators)/scanner/[token]/page.tsx`
   - Components: `src/components/scanner/QRScannerModal.tsx`
   - API: `src/app/api/share/`

6. **محور بوابة الطالب (Student Portal & System)**
   - Pages: `src/app/(students)/system/page.tsx`, `src/app/(students)/student-portal/[token]/page.tsx`, `src/app/(students)/verify/[code]/page.tsx`
   - Components: `src/components/students/`
     - `StudentAuthView.tsx` (التسجيل والدخول وإثبات الهوية)
     - `StudentPendingView.tsx` (شاشة انتظار التفعيل)
     - `StudentProjectsTab.tsx` (تبويب المشاريع والتقييمات)
     - `StudentAttendanceTab.tsx` (تبويب سجل الحضور والغياب)
     - `StudentWarningsTab.tsx` (تبويب الإنذارات)
     - `StudentArtworkCameraModal.tsx` (كاميرا تصوير المشاريع الذكية)
     - `StudentSelfieModal.tsx` (كاميرا السيلفي للكارنيه)
     - `StudentQrModal.tsx` (نافذة الكارنيه الرقمي QR)
     - `StudentMigrationNotice.tsx` (إشعار تطبيق الأندرويد)
   - Lib: `src/lib/students/` (`codeHelper.ts`, `imageCompressor.ts`, `qrCardDownloader.ts`)
   - API: `src/app/api/student/`, `src/app/api/students/`

7. **محور خزائن الطلاب / الدواليب (Lockers System)**
   - Components: `src/components/lockers/` (`AdminLockersTab.tsx`, `StudentLockerTab.tsx`)
   - Lib: `src/lib/lockers/lockersService.ts`
   - API: `src/app/api/lockers/`

8. **محور المصادقة والأمان (Auth, Device Fingerprint & Rate Limiting)**
   - Components: `src/components/auth/InAppBrowserGuard.tsx`
   - Lib: `src/lib/auth/` (`apiAuth.ts`, `deviceFingerprint.ts`, `rateLimiter.ts`)
   - API: `src/app/api/auth/`

9. **محور البوت والإشعارات وتطبيق الويب (Telegram Bot & PWA/FCM)**
   - Pages: `src/app/(telegram)/telegram-panel/page.tsx`
   - Components: `src/components/pwa/` (`PWAInstallBanner.tsx`, `ServiceWorkerRegistration.tsx`)
   - Lib: `src/lib/telegram/` (`botService.ts`, `telegramLogger.ts`)
   - API: `src/app/api/telegram/`, `src/app/api/notifications/`

10. **محور النواة وقاعدة البيانات (Core & Database SQL)**
    - Layout: `src/app/layout.tsx`, `src/components/layout/InteractiveBackground.tsx`
    - Lib: `src/lib/core/` (`supabaseClient.ts`, `googleDrive.ts`, `imageUrl.ts`)
    - Database SQL: `database/schema/`, `database/security/`, `database/triggers/`
