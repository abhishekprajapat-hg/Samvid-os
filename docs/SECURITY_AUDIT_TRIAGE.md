# Security Audit Triage

Date: 2026-07-28

This report was produced from the local `main` checkout using local test resources only. No production, VPS, or non-test database was used for automated security tests.

## Audit Summary

| Area | Production audit | Full audit | Status |
| --- | --- | --- | --- |
| Backend | 0 vulnerabilities | 0 vulnerabilities | Fixed |
| Frontend | 0 high, 2 moderate | 5 high, 2 moderate | Highs fixed or dev-only accepted |
| Mobile | 47 high, 9 moderate | 63 high, 9 moderate | Formal controlled migration required |

## Fixed Findings

- Backend NoSQL operator-shaped login credentials could match a real user before validation. Fixed by requiring string `email` and `password` before authentication lookup.
- Backend dev dependency highs through `nodemon -> minimatch -> brace-expansion` were fixed by targeted non-forced dev dependency updates.
- Frontend React Router high RSC CSRF advisory was removed from the production audit by moving away from the vulnerable 7.x line. `react-router-dom@7.18.1` still reports the high RSC advisory; `react-router-dom@8.x` is not available as a compatible package path for this SPA.
- Frontend active browser workbook parsing through `xlsx` was removed. Bulk lead browser import now accepts CSV only, and `xlsx` is no longer installed.
- Mobile Field Ops map WebView wildcard navigation and map-popup HTML injection were restricted. The local HTML map no longer uses `originWhitelist={["*"]}`, DOM storage, file access, universal file URL access, multiple windows, unescaped popup text, or inline popup event handlers.

## Accepted Findings

### Frontend Dev-Only ESLint Chain

- Finding: Full audit reports 5 high dev-only findings through `eslint`, `@eslint/config-array`, `@eslint/eslintrc`, `minimatch`, and `brace-expansion`.
- Reachability: Development and CI lint tooling only; not bundled into the production browser build.
- Attempted remediation: `eslint@10.8.0` was investigated but conflicts with the current `eslint-plugin-react-hooks@7.0.1` peer range, which supports up to ESLint 9.
- Owner: Frontend Platform Owner.
- Expiry: 2026-09-30.
- Compensating controls: Do not expose Vite or lint tooling publicly; run lint only in trusted CI/local environments; keep `npm audit --omit=dev --audit-level=high` enforceable for release; revisit when React Hooks ESLint peer support allows ESLint 10.

### Frontend React Router Moderates

- Finding: Production audit reports 2 moderate findings in `react-router` / `react-router-dom@6.30.4`.
- Reachability: The app is a Vite SPA and does not use React Router SSR hydration or RSC server actions. Open-redirect exposure still requires review wherever user-controlled values reach `<Link>` or `navigate`.
- Owner: Frontend Platform Owner.
- Expiry: 2026-09-30.
- Compensating controls: Keep route construction internal and tenant-slug sanitized; block `javascript:` and backslash-prefixed navigation in new route helpers/tests; monitor for a fixed React Router release that does not reintroduce the 7.x high RSC advisory.

### Mobile Expo / React Native Major Migration

- Finding: Mobile production audit reports 47 high and 9 moderate findings; full audit reports 63 high and 9 moderate findings.
- Reachability: Findings are rooted in Expo SDK 54 / React Native 0.81.5 and transitive Metro/dev/native build chains including `@expo/cli`, `@react-native/dev-middleware`, `react-native`, `postcss`, `minimatch`, `brace-expansion`, and related native package dependents. Some packages are development/build-time, but the app depends on the affected Expo/RN line and cannot be cleared with a safe patch update.
- Attempted remediation: npm recommends `expo@57.0.8` and `react-native@0.86.2`, which is a major native migration. This was not forced because it requires Android/iOS native regression testing, WebRTC verification, push notification verification, and build pipeline validation.
- Owner: Mobile Platform Owner.
- Expiry: 2026-10-31.
- Compensating controls: Do not expose Expo/Metro/dev-client servers publicly; ship signed production builds only; pin dependencies; run native migration on a dedicated branch with fresh install/upgrade, permissions, push, upload, WebRTC, and Maestro coverage before release.

## Scanner Results And Blockers

- CodeQL: Not run locally; `codeql` and `gh` were not installed.
- Gitleaks: Not run locally; `gitleaks` was not installed.
- OWASP ZAP: Not run locally; `zap-baseline.py` and Docker were not installed, and no isolated staging URL was provided. Do not run ZAP against production.
- Secret scanning: Local regex sweep found no high-confidence AWS, Google, GitHub, Slack, OpenAI, private-key, or Cloudinary secret patterns. MongoDB URI-like matches were placeholders in docs and `.env.example`.

## Regression Coverage

- Backend JWT tampering, refresh-token rotation/reuse, portal restrictions, inactive users/companies, and NoSQL operator-shaped login credentials are covered in `tests/integration/authPhase2.test.js`.
- Backend brute-force/rate-limit behavior is covered in `tests/unit/rateLimitMiddleware.test.js`.
- Backend tenant isolation and IDOR protections are covered in `tests/integration/companyIsolationPhase2.test.js`.
- Backend CORS and security headers are covered in `tests/integration/app.test.js`.
- Backend malicious uploads, upload response contracts, storage failures, socket authorization, call signaling boundaries, and Meta webhook signature verification are covered in `tests/integration/chatRealtimeWebhookPhase.test.js`.
- Backend structured log redaction for authorization headers, passwords, access tokens, and refresh tokens is covered in `tests/unit/loggerRedaction.test.js`.
- Frontend CSV/formula export protection is covered in `src/utils/csvSafety.test.js`.
- Frontend bulk lead upload policy and removal of active SheetJS imports are covered in `src/modules/leads/bulkLeadFilePolicy.test.js`.
- Mobile WebView navigation/storage hardening and map-popup XSS protection are covered in `src/modules/field/FieldOpsScreen.test.tsx`.

## Remaining Release Risks

- Mobile dependency audit remains high until the Expo/RN major migration is completed or the above risk acceptance is formally approved.
- CodeQL, Gitleaks, and ZAP are not proven in this workstation environment. CI should install and enforce them before release.
- ZAP still needs an isolated staging deployment with synthetic data and test credentials.
- React Router moderate findings remain accepted temporarily; new user-controlled navigation paths need tests before merging.
