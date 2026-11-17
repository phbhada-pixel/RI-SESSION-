# PHC Bhada – Digital Vaccination Session & Beneficiary Management System
**प्राथमिक आरोग्य केंद्र भादा | डिजिटल लसीकरण व्यवस्थापन प्रणाली**

A mobile-responsive Marathi web application for managing beneficiary registrations, village vaccination sessions, age-on-session-date eligibility screening, digital tick-mark sheets, 2-day IST editing windows, immutable audit logs, and government reports backed **exclusively by Google Sheets** (`phbhada@gmail.com`).

---

## 1. Storage Architecture (100% Google Sheets)
- **Zero external databases**: No Firestore, MongoDB, MySQL, SQLite, or browser `localStorage`/`sessionStorage` data persistence is used.
- **Single Source of Truth**: All operational records live directly in a Google Spreadsheet owned by **`phbhada@gmail.com`** titled `PHC Bhada - Digital Vaccination Management System`.
- **Automatic Spreadsheet & Schema Creation**:
  When `phbhada@gmail.com` signs in via Google OAuth (`https://www.googleapis.com/auth/spreadsheets` & `https://www.googleapis.com/auth/drive.file`), the app automatically creates the spreadsheet with frozen styled headers across all 12 tabs:
  - `users`, `subcentres`, `villages`, `staff`, `beneficiaries`, `vaccinationSessions`, `sessionBeneficiaries`, `vaccineMaster`, `vaccineSchedule`, `vaccinationRecords`, `auditLogs`, `systemSettings`
- **Multi-Gmail Central Saving**:
  Once `phbhada@gmail.com` creates and shares the central spreadsheet (via the confirmation prompt in the header or **Settings**), staff signing in with any Gmail account automatically read and write directly to `phbhada@gmail.com`'s central spreadsheet via `/api/central-sheet` (which stores only the spreadsheet ID pointer).

---

## 2. Project Structure (`phc-bhada-vaccination-management`)
```text
├── server.ts                         # Express + Vite server (/api/central-sheet, /api/server-time)
├── google-apps-script/
│   └── Code.gs                       # Optional Google Apps Script companion for phbhada@gmail.com
├── src/
│   ├── config/firebase.ts            # Google Workspace OAuth sign-in (in-memory token only)
│   ├── context/SheetDataContext.tsx   # Live Google Sheets state, sync status, server lock checks
│   ├── services/googleSheetsService.ts # Google Sheets v4 & Drive v3 REST API client
│   ├── utils/                        # IST date math, NIS eligibility engine, Excel/PDF exports
│   ├── components/                   # Layout, SearchableSelect, ConfirmModal, Toast
│   └── pages/                        # All 16 Marathi modules + LoginPage
└── .env.example                      # Safe template (never commit secrets)
```

---

## 3. Setup & Running Locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure OAuth / environment (do not commit `.env` or `serviceAccountKey.json`).
3. Start development server on port `3000`:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   npm start
   ```

---

## 4. Security & GitHub Hygiene
- Never commit `.env`, `.central-sheet-pointer.json`, OAuth client secrets, or personal beneficiary exports to GitHub.
- OAuth access tokens remain strictly in memory (`cachedAccessToken`) and are never written to `localStorage` or `sessionStorage`.
- Session 2-day IST editing deadlines (`sessionDate + 2 days 23:59:59 IST`) are validated against `/api/server-time`.
