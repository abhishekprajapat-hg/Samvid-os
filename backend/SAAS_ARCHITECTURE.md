# Multi-Tenant SaaS Foundation

This backend now supports:

- Platform-level `SUPER_ADMIN`
- Tenant-level `ADMIN` and existing company roles
- Company tenant records with subdomain/custom-domain mapping
- Subscription plans + tenant subscriptions
- Super admin controls for company onboarding, plan management, subscriptions, usage, and global analytics

## Roles

- `SUPER_ADMIN`: global control across all companies
- `ADMIN`: company/tenant admin (single company scope)
- Existing hierarchy roles remain unchanged

## Tenant Routing

Tenant context is resolved from request host:

- Subdomain (`company1.crmplatform.com`) using `Company.subdomain`
- Custom domain using `Company.customDomain`

Environment:

- `SAAS_ROOT_DOMAIN=crmplatform.com`
- `SAAS_RESERVED_SUBDOMAINS=www,api,app,admin`
- `SAAS_REQUIRE_TENANT_HOST=false` (set `true` to enforce host-tenant match for tenant users)

## New Models

- `Company`
- `SubscriptionPlan`
- `TenantSubscription`

## New APIs

Base route: `/api/saas` (also available under `/api/client/saas`)

Tenant admin:

- `GET /tenant/settings`
- `PATCH /tenant/settings`

Super admin:

- `GET /tenant/resolve`
- `GET /companies`
- `POST /companies`
- `PATCH /companies/:companyId`
- `GET /plans`
- `POST /plans`
- `PATCH /plans/:planId`
- `POST /subscriptions/assign`
- `GET /usage/:companyId`
- `GET /analytics/global`

## Bootstrap / Migration

Create platform super admin:

```bash
npm run seed:super-admin
```

Backfill company tenant records from existing `User.companyId`:

```bash
npm run seed:companies:backfill
```

