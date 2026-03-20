# Samvid OS Full Project Documentation

Generated on: 2026-03-20T00:00:00.000Z

This documentation set combines generated code-surface docs with curated workflow and testing docs.

## Documents
- [Web Frontend Pages and Components](./FRONTEND_WEB_DOCUMENTATION.md)
- [Mobile Screens and Components](./MOBILE_APP_DOCUMENTATION.md)
- [Backend Functionality and API Surface](./BACKEND_FUNCTIONALITY_DOCUMENTATION.md)
- [Visual System Workflow](./SYSTEM_WORKFLOW_VISUAL.md)
- [End-to-End Testing Flow](./TESTING_FLOW.md)

## Scope
- Every web page/component under `frontend/src/modules`, `frontend/src/components`, and app shell files.
- Every mobile screen/component under `mobile/src/modules`, `mobile/src/components`, plus root/navigation/context modules.
- Backend route/controller/service coverage with route endpoint extraction.
- Visual workflow coverage for tenant, auth, lead, inventory, chat, reporting, and SaaS flows.

## Update Workflow
1. Run `node docs/scripts/generate-project-docs.mjs` from repository root.
2. Review changed markdown files in `docs/`, including curated docs linked from this index.
3. Commit docs updates with the corresponding code changes.
