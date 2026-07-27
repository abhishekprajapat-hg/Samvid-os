# Security Audit Triage

Date: 2026-07-27

## Backend

Command:

```powershell
npm audit --omit=dev --audit-level=high
```

Result after non-forced remediation: `found 0 vulnerabilities`.

Fixed through compatible dependency updates:

- `axios`
- `engine.io` / `socket.io` transitive chain
- `mongoose`
- `path-to-regexp`
- `ws`
- related transitive packages

## Frontend

Command:

```powershell
npm audit --omit=dev --audit-level=high
```

Remaining high advisories:

- `react-router` through `react-router-dom@7.18.1`
  - Reachability: package is runtime-reachable in the browser shell, but the remaining advisory is RSC/server-action specific. Samvid web is a Vite SPA and does not run React Router RSC actions.
  - Attempted remediation: `react-router-dom@7.11.0` as a normal install increased advisory exposure, so latest 7.x was restored.
  - Status: document and monitor for a fixed 7.x release or a safe router upgrade path.
- `xlsx@0.18.5`
  - Reachability: active lead workbook import parses user-supplied `.xls/.xlsx` in the browser.
  - Fix availability: npm audit reports no fixed npm version.
  - Status: high risk accepted only temporarily; replace with a maintained parser, isolate parsing server-side with strict limits, or restrict active imports to CSV in a follow-up phase.

## Mobile

Command:

```powershell
npm audit --omit=dev --audit-level=high
```

Remaining high advisories are Expo SDK 54 / React Native 0.81 transitive toolchain packages such as `brace-expansion`, `postcss`, and `ws`.

Reachability:

- Mostly development/build/tooling and Metro/dev middleware paths.
- `ws` is present in React Native and Expo dev chains; production native runtime exposure must be reviewed during an Expo SDK upgrade.

Remediation status:

- Non-forced audit remediation applied.
- npm recommends Expo 57 / React Native 0.86 for full cleanup, which is a major SDK jump and intentionally deferred until full native regression infrastructure is available.
