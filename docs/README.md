# Samvid OS Full Project Documentation

Generated on: 2026-03-09T06:43:34.484Z

This documentation set is generated directly from source code to cover pages, components, route surfaces, and core functionality modules.

## Documents
- [Web Frontend Pages and Components](./FRONTEND_WEB_DOCUMENTATION.md)
- [Mobile Screens and Components](./MOBILE_APP_DOCUMENTATION.md)
- [Backend Functionality and API Surface](./BACKEND_FUNCTIONALITY_DOCUMENTATION.md)
- [End-to-End Testing Flow](./TESTING_FLOW.md)

## Scope
- Every web page/component under `frontend/src/modules`, `frontend/src/components`, and app shell files.
- Every mobile screen/component under `mobile/src/modules`, `mobile/src/components`, plus root/navigation/context modules.
- Backend route/controller/service coverage with route endpoint extraction.

## Update Workflow
1. Run `node docs/scripts/generate-project-docs.mjs` from repository root.
2. Review changed markdown files in `docs/`.
3. Commit docs updates with the corresponding code changes.
