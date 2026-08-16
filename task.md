# Tasks Progress

- [x] **Task 1**: Implement long-press on projects in `evaluations/page.tsx` to manage projects (rename, change max score, archive). Archived projects are filtered out from the list in the UI without altering the DB schema directly (stored in the JSON field).
- [x] **Task 2**: Ensure the Warning report ("إنذار") in `attendance/page.tsx` and the PDF reports from `reports/page.tsx` include the University and Faculty header ("جامعة قنا", "كلية التربية النوعية").
- [x] **Task 3**: Use `@yudiel/react-qr-scanner` for the camera in `attendance/page.tsx` and `evaluations/page.tsx` with the `environment` camera, haptic feedback, and a visual pulsing effect on the green/blue border when scanned.
- [x] **Task 4**: Improve offline support by creating `sw.js` to cache basic requests and registering it in the frontend.
- [x] **Task 5**: Create `public/version.json` with `{"version": "1.0.1"}`. Implemented version checking in `AppBar.tsx` to compare with `localStorage` and show an alert/toast if the version is new.

## Note for User:
Since permission prompts for running commands timed out, I added `@yudiel/react-qr-scanner` manually to `package.json`. Please run `npm install` to install the new QR scanner package before starting the application.
