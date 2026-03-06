# Mobile-Web Parity Queue

## Status
- Completed in this batch:
  - Role model parity (assistant manager, team leader, channel partner)
  - Role navigation parity baseline
  - Admin Console screen (mobile)
  - User Details Editor screen (mobile)
  - Persistent System Settings + session timeout enforcement
- Verified:
  - `npx tsc --noEmit` passes
  - `npx expo export --platform web` passes

## Remaining Queue

### P0 - Core Workflow Parity
- Chat module deep parity:
  - advanced conversation panels
  - admin alert pathways
  - role badge parity
  - richer attachment/call state UX
- Inventory module deep parity:
  - request/review workflows at full web depth
  - section-level parity with web AssetVault structure
- Leads module deep parity:
  - full section parity with web rebuilt lead details
  - admin review/approval branches

### P1 - Admin & Management UX Parity
- Admin notifications feature parity (full filters/actions stack)
- Team manager advanced cards/panels parity
- Profile parity with role-specific summary cards

### P2 - UI/Visual Parity
- Header/navbar interaction language parity on mobile screens
- Motion tuning to match web intent (without harming mobile usability)
- Color/spacing/token unification for shared modules

### P3 - QA and Hardening
- Role-wise regression checklist (Admin, Manager, Assistant Manager, Team Leader, Executive, Field Executive, Channel Partner)
- Android crash watchlist + error boundary improvements
- Optional: add automated smoke checks for key routes/screens

