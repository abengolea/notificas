# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
`Notificas` — a single product (not a multi-product monorepo) with two deployable code units:
- **Next.js 15 web app** (repo root, `src/`) — the product UI + ~55 API routes under `src/app/api/`. This is the main service.
- **Firebase Cloud Functions** (`functions/`) — email send + open/click/read tracking, incoming email, WhatsApp webhook, scheduled blockchain-certify retries.

Backing services are all Firebase (Firestore + Firebase Auth). There is no Docker/SQL. Project: `notificas-f9953`.

### Running / testing (standard commands)
Root app scripts live in `package.json`; functions scripts in `functions/package.json`.
- Dev server: `npm run dev` → serves on **port 9006** (`next dev -p 9006`), not 9003.
- Lint: `npm run lint`. Typecheck: `npm run typecheck`.
- Functions unit tests: `cd functions && npm test` (Node `node --test`).

### Non-obvious caveats
- **`.env.local` is required to run the app and is gitignored**, so a fresh VM won't have it. Run `./setup-env-development.sh` to generate it with the public Firebase web config for `notificas-f9953` (the `NEXT_PUBLIC_FIREBASE_*` keys). Without these the client Firebase init logs an error in dev (and throws in production builds).
- **The client does NOT use the Firebase emulators.** Despite `.idx/dev.nix` declaring `auth`/`firestore` emulators, `src/lib/firebase.ts` has no `connectAuthEmulator`/`connectFirestoreEmulator` wiring — client auth/Firestore always hit the **real** `notificas-f9953` project. So signing up/logging in in dev creates real records in that project.
- **Server-side (admin) API routes need a service account** (`FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`, see `src/lib/firebase-admin.ts`). These are NOT in the public dev config, so admin-backed routes (e.g. `/api/auth/legacy-migration-state`, `/api/contact`, sending email) throw `Firebase Admin credentials are not fully configured.` Client-side auth + Firestore + the whole UI (landing, signup, login, dashboard) work fine without them. The signup flow tolerates the admin route 500ing and still creates the user client-side.
- **Lint currently fails** (`npm run lint` uses `--max-warnings 0` and there are ~298 pre-existing errors, mostly in root-level `*.js` maintenance/test scripts and `any` usages). This is pre-existing, not caused by setup. `npm run typecheck` passes clean.
- **Node:** functions require Node 22 (`functions/package.json` engines); the root app targets Node 20 in `.idx/dev.nix` but runs fine on Node 22.
- Optional integrations (Polygon blockchain, Mercado Pago, WhatsApp, SMTP, Genkit/Gemini, LegalMev, Notificas Hub) each need their own secrets and are not required to run/test the core app.
