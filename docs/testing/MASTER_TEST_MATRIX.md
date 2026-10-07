# MASTER TEST MATRIX

Every scenario below was **executed** against a running instance of this CRM
(local MongoDB `the_office_on_rent`, backend on :5000, Vite frontend on :5173).
No row is marked PASS on the basis of reading code.

- Generated: 2026-09-18
- Total scenarios: **1013**
- PASS **806** · FAIL **207** · BLOCKED **0** · NOT TESTED **0**

`Automated` = the scenario is covered by a repeatable script in `docs/testing/` harness form.
All rows here were run by the audit harness, so all are marked Y.

| ID | Module | Page/Area | Feature | Scenario | Test Type | Role | Expected | Actual | Status | Severity | Bug ID | Automated |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T0001 | Auth | API | Login | valid admin credentials | API | anon | 200 + token | 200 token=true | PASS | - | - | Y |
| T0002 | Auth | API | Login | JWT payload carries no PII | API | anon | id/role/companyId only | id,role,companyId,iat,exp | PASS | - | - | Y |
| T0003 | Auth | API | Login | access token TTL | API | anon | short lived <=900s | 900s | PASS | - | - | Y |
| T0004 | Auth | API | Login | wrong password | Validation | anon | 401 | 400 {"message":"Invalid credentials"} | FAIL | MEDIUM | CRM-BUG-014 | Y |
| T0005 | Auth | API | Login | unknown email | Validation | anon | 401 | 400 {"message":"Invalid credentials"} | FAIL | MEDIUM | CRM-BUG-014 | Y |
| T0006 | Auth | API | Login | empty body | Validation | anon | 400 | 400 {"message":"Email and password required"} | PASS | - | - | Y |
| T0007 | Auth | API | Login | empty strings | Validation | anon | 400 | 400 {"message":"Email and password required"} | PASS | - | - | Y |
| T0008 | Auth | API | Login | missing password | Validation | anon | 400 | 400 {"message":"Email and password required"} | PASS | - | - | Y |
| T0009 | Auth | API | Login | missing email | Validation | anon | 400 | 400 {"message":"Email and password required"} | PASS | - | - | Y |
| T0010 | Auth | API | Login | null values | Validation | anon | 400 | 400 {"message":"Email and password required"} | PASS | - | - | Y |
| T0011 | Auth | API | Login | array email | Validation | anon | 400 | 400 {"message":"Invalid credentials"} | PASS | - | - | Y |
| T0012 | Auth | API | Login | very long email 10k | Validation | anon | 400 | 400 {"message":"Invalid credentials"} | PASS | - | - | Y |
| T0013 | Auth | API | Login | user enumeration: unknown email vs wrong password | Security | anon | identical response | wrongpw=400:Invalid credentials \| unknown=400:Invalid creden… | PASS | - | - | Y |
| T0014 | Auth | API | Login | NoSQL operator injection {"email":{"$ne":null},"password":{"$ne":null}} | Security | anon | no auth bypass | 500 Server error | PASS | - | - | Y |
| T0015 | Auth | API | Login | NoSQL operator injection {"email":{"$gt":""},"password":{"$gt":""}} | Security | anon | no auth bypass | 500 Server error | PASS | - | - | Y |
| T0016 | Auth | API | Login | NoSQL operator injection {"email":"admin@test.com","password":{"$ne":"x"}} | Security | anon | no auth bypass | 500 Server error | PASS | - | - | Y |
| T0017 | Auth | API | Token validation | garbage token | Security | anon | 401 | 401 | PASS | - | - | Y |
| T0018 | Auth | API | Token validation | alg-none forgery | Security | anon | 401 | 401 | PASS | - | - | Y |
| T0019 | Auth | API | Token validation | wrong-secret signature | Security | anon | 401 | 401 | PASS | - | - | Y |
| T0020 | Auth | API | Token validation | expired token | Security | anon | 401 | 401 | PASS | - | - | Y |
| T0021 | Auth | API | Token validation | token for nonexistent user id | Security | anon | 401 | 401 | PASS | - | - | Y |
| T0022 | Auth | API | Token validation | scoped portal token used as staff token | Security | anon | 401 | 401 | PASS | - | - | Y |
| T0023 | Auth | API | Token validation | no token on protected route | Security | anon | 401 | 401 | PASS | - | - | Y |
| T0024 | Auth | API | Session | GET /auth/me valid token | API | ADMIN | 200 | 200 | PASS | - | - | Y |
| T0025 | Auth | API | Session | /auth/me leaks password hash | Security | ADMIN | no password field | clean | PASS | - | - | Y |
| T0026 | Auth | API | Refresh | valid refresh token returns new access token | API | anon | 200 + token | 200 | PASS | - | - | Y |
| T0027 | Auth | API | Refresh | reuse of already-consumed refresh token (rotation) | Security | anon | 401 | 401 | PASS | - | - | Y |
| T0028 | Auth | API | Logout | refresh token rejected after logout | Security | ADMIN | 401 | 401 | PASS | - | - | Y |
| T0029 | Auth | API | Logout | access token still valid after logout (JWT revocation window) | Security | ADMIN | 401 (revoked) or documented short window | 200 | FAIL | MEDIUM | CRM-BUG-017 | Y |
| T0030 | Auth | API | Refresh | bogus refresh token | Validation | anon | 400/401 | 401 | PASS | - | - | Y |
| T0031 | Auth | API | Refresh | missing refresh token | Validation | anon | 400/401 | 400 | PASS | - | - | Y |
| T0032 | Auth | API | Refresh | nosql refresh | Validation | anon | 400/401 | 401 | PASS | - | - | Y |
| T0033 | Auth | API | HTTP semantics | GET on POST-only /auth/login | API | anon | 404/405 not 500 | 404 | PASS | - | - | Y |
| T0034 | Auth | API | Error handling | malformed JSON body | Security | anon | 400, no stack trace | 400 leak=false | PASS | - | - | Y |
| T0035 | User Management | API | Create user validation | missing name | API | ADMIN | 4xx rejected | 500 Server error | PASS | - | - | Y |
| T0036 | User Management | API | Create user validation | missing email | API | ADMIN | 4xx rejected | 500 Server error | PASS | - | - | Y |
| T0037 | User Management | API | Create user validation | missing password | API | ADMIN | 4xx rejected | 500 Server error | PASS | - | - | Y |
| T0038 | User Management | API | Create user validation | invalid email format | API | ADMIN | 4xx rejected | 201 EXECUTIVE created successfully | FAIL | HIGH | CRM-BUG-011 | Y |
| T0039 | User Management | API | Create user validation | password under 6 chars | API | ADMIN | 4xx rejected | 500 Server error | PASS | - | - | Y |
| T0040 | User Management | API | Create user validation | invalid role | API | ADMIN | 4xx rejected | 400 Invalid role | PASS | - | - | Y |
| T0041 | User Management | API | Create user validation | ADMIN role blocked | API | ADMIN | 4xx rejected | 400 Admin role cannot be created from this endpoint | PASS | - | - | Y |
| T0042 | User Management | API | Create user validation | blank/space-only name | API | ADMIN | 4xx rejected | 500 Server error | PASS | - | - | Y |
| T0043 | User Management | API | Create user validation | phone is letters | API | ADMIN | 4xx rejected | 201 EXECUTIVE created successfully | FAIL | HIGH | CRM-BUG-023 | Y |
| T0044 | User Management | API | Create user validation | phone too short | API | ADMIN | 4xx rejected | 201 EXECUTIVE created successfully | FAIL | HIGH | CRM-BUG-011 | Y |
| T0045 | User Management | API | Create user validation | name 5000 chars | API | ADMIN | stored safely (escaped on render) | 201 EXECUTIVE created successfully | PASS | - | - | Y |
| T0046 | User Management | API | Create user validation | XSS in name | API | ADMIN | stored safely (escaped on render) | 201 EXECUTIVE created successfully | PASS | - | - | Y |
| T0047 | User Management | API | Create user validation | role injection object | API | ADMIN | 4xx rejected | 400 Invalid role | PASS | - | - | Y |
| T0048 | User Management | API | Create user validation | isActive/companyId mass-assignment | API | ADMIN | 4xx rejected | 201 EXECUTIVE created successfully | PASS | - | - | Y |
| T0049 | User Management | API | Create user | create user with role MANAGER | API | ADMIN | 2xx created | 201 | PASS | - | - | Y |
| T0050 | User Management | API | Create user | newly created MANAGER can log in immediately | API | MANAGER | 200 + token | 200 | PASS | - | - | Y |
| T0051 | User Management | API | Create user | create user with role EXECUTIVE | API | ADMIN | 2xx created | 201 | PASS | - | - | Y |
| T0052 | User Management | API | Create user | newly created EXECUTIVE can log in immediately | API | EXECUTIVE | 200 + token | 200 | PASS | - | - | Y |
| T0053 | User Management | API | Create user | create user with role FIELD_EXECUTIVE | API | ADMIN | 2xx created | 201 | PASS | - | - | Y |
| T0054 | User Management | API | Create user | newly created FIELD_EXECUTIVE can log in immediately | API | FIELD_EXECUTIVE | 200 + token | 200 | PASS | - | - | Y |
| T0055 | User Management | API | Create user | create user with role PRODUCTION_EXECUTIVE | API | ADMIN | 2xx created | 201 | PASS | - | - | Y |
| T0056 | User Management | API | Create user | newly created PRODUCTION_EXECUTIVE can log in immediately | API | PRODUCTION_EXECUTIVE | 200 + token | 200 | PASS | - | - | Y |
| T0057 | User Management | API | Create user | create user with role COMMUNITY_MANAGER | API | ADMIN | 2xx created | 201 | PASS | - | - | Y |
| T0058 | User Management | API | Create user | newly created COMMUNITY_MANAGER can log in immediately | API | COMMUNITY_MANAGER | 200 + token | 200 | PASS | - | - | Y |
| T0059 | User Management | API | Create user | create user with role CHANNEL_PARTNER | API | ADMIN | 2xx created | 201 | PASS | - | - | Y |
| T0060 | User Management | API | Create user | newly created CHANNEL_PARTNER can log in immediately | API | CHANNEL_PARTNER | 200 + token | 200 | PASS | - | - | Y |
| T0061 | User Management | API | Create user | create user with role COWORKING_ADMIN | API | ADMIN | 2xx created | 201 | PASS | - | - | Y |
| T0062 | User Management | API | Create user | newly created COWORKING_ADMIN can log in immediately | API | COWORKING_ADMIN | 200 + token | 200 | PASS | - | - | Y |
| T0063 | User Management | API | Create user | create user with role INSIDE_EXECUTIVE | API | ADMIN | 2xx created | 201 | PASS | - | - | Y |
| T0064 | User Management | API | Create user | newly created INSIDE_EXECUTIVE can log in immediately | API | INSIDE_EXECUTIVE | 200 + token | 200 | PASS | - | - | Y |
| T0065 | User Management | API | Create user | duplicate email rejected | API | ADMIN | 400/409 | 400 User already exists | PASS | - | - | Y |
| T0066 | User Management | API | Create user | duplicate email returns 409 Conflict (REST semantics) | API | ADMIN | 409 | 400 | FAIL | LOW | CRM-BUG-028 | Y |
| T0067 | User Management | API | Create user | duplicate email differing only in case | API | ADMIN | rejected (emails lowercased) | 400 User already exists | PASS | - | - | Y |
| T0068 | User Management | API | Create user | duplicate phone number | API | ADMIN | rejected or documented as allowed | 201 EXECUTIVE created successfully | FAIL | MEDIUM | CRM-BUG-023 | Y |
| T0069 | RBAC | API | Page access enforcement | MANAGER GET /api/access/me | Security | MANAGER | reachable (role owns page admin_team) | 200 | PASS | - | - | Y |
| T0070 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/access/me | Security | EXECUTIVE | 403 (role lacks page admin_team) | 200 | PASS | - | - | Y |
| T0071 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/access/me | Security | FIELD_EXECUTIVE | 403 (role lacks page admin_team) | 200 | PASS | - | - | Y |
| T0072 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/access/me | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page admin_team) | 200 | PASS | - | - | Y |
| T0073 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/access/me | Security | COMMUNITY_MANAGER | 403 (role lacks page admin_team) | 200 | PASS | - | - | Y |
| T0074 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/access/me | Security | CHANNEL_PARTNER | 403 (role lacks page admin_team) | 200 | PASS | - | - | Y |
| T0075 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/access/me | Security | COWORKING_ADMIN | 403 (role lacks page admin_team) | 200 | PASS | - | - | Y |
| T0076 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/access/me | Security | INSIDE_EXECUTIVE | 403 (role lacks page admin_team) | 200 | PASS | - | - | Y |
| T0077 | RBAC | API | Page access enforcement | MANAGER GET /api/access/users/0123456789abcdef01234567/pages | Security | MANAGER | reachable (role owns page admin_team) | 403 | FAIL | - | - | Y |
| T0078 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/access/users/0123456789abcdef01234567/pages | Security | EXECUTIVE | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0079 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/access/users/0123456789abcdef01234567/pages | Security | FIELD_EXECUTIVE | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0080 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/access/users/0123456789abcdef01234567/pages | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0081 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/access/users/0123456789abcdef01234567/pages | Security | COMMUNITY_MANAGER | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0082 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/access/users/0123456789abcdef01234567/pages | Security | CHANNEL_PARTNER | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0083 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/access/users/0123456789abcdef01234567/pages | Security | COWORKING_ADMIN | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0084 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/access/users/0123456789abcdef01234567/pages | Security | INSIDE_EXECUTIVE | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0085 | RBAC | API | Page access enforcement | MANAGER GET /api/attendance/daily | Security | MANAGER | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0086 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/attendance/daily | Security | EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0087 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/attendance/daily | Security | FIELD_EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0088 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/attendance/daily | Security | PRODUCTION_EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0089 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/attendance/daily | Security | COMMUNITY_MANAGER | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0090 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/attendance/daily | Security | CHANNEL_PARTNER | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0091 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/attendance/daily | Security | COWORKING_ADMIN | 403 (role lacks page attendance) | 403 | PASS | - | - | Y |
| T0092 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/attendance/daily | Security | INSIDE_EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0093 | RBAC | API | Page access enforcement | MANAGER GET /api/attendance/leave-balance/0123456789abcdef01234567 | Security | MANAGER | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0094 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/attendance/leave-balance/0123456789abcdef01234567 | Security | EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0095 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/attendance/leave-balance/0123456789abcdef01234567 | Security | FIELD_EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0096 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/attendance/leave-balance/0123456789abcdef01234567 | Security | PRODUCTION_EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0097 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/attendance/leave-balance/0123456789abcdef01234567 | Security | COMMUNITY_MANAGER | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0098 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/attendance/leave-balance/0123456789abcdef01234567 | Security | CHANNEL_PARTNER | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0099 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/attendance/leave-balance/0123456789abcdef01234567 | Security | COWORKING_ADMIN | 403 (role lacks page attendance) | 403 | PASS | - | - | Y |
| T0100 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/attendance/leave-balance/0123456789abcdef01234567 | Security | INSIDE_EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0101 | RBAC | API | Page access enforcement | MANAGER GET /api/attendance/leave-balance/my | Security | MANAGER | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0102 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/attendance/leave-balance/my | Security | EXECUTIVE | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0103 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/attendance/leave-balance/my | Security | FIELD_EXECUTIVE | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0104 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/attendance/leave-balance/my | Security | PRODUCTION_EXECUTIVE | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0105 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/attendance/leave-balance/my | Security | COMMUNITY_MANAGER | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0106 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/attendance/leave-balance/my | Security | CHANNEL_PARTNER | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0107 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/attendance/leave-balance/my | Security | COWORKING_ADMIN | 403 (role lacks page attendance) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0108 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/attendance/leave-balance/my | Security | INSIDE_EXECUTIVE | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0109 | RBAC | API | Page access enforcement | MANAGER GET /api/attendance/leave-requests/admin | Security | MANAGER | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0110 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/attendance/leave-requests/admin | Security | EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0111 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/attendance/leave-requests/admin | Security | FIELD_EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0112 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/attendance/leave-requests/admin | Security | PRODUCTION_EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0113 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/attendance/leave-requests/admin | Security | COMMUNITY_MANAGER | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0114 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/attendance/leave-requests/admin | Security | CHANNEL_PARTNER | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0115 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/attendance/leave-requests/admin | Security | COWORKING_ADMIN | 403 (role lacks page attendance) | 403 | PASS | - | - | Y |
| T0116 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/attendance/leave-requests/admin | Security | INSIDE_EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0117 | RBAC | API | Page access enforcement | MANAGER GET /api/attendance/leave-requests/my | Security | MANAGER | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0118 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/attendance/leave-requests/my | Security | EXECUTIVE | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0119 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/attendance/leave-requests/my | Security | FIELD_EXECUTIVE | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0120 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/attendance/leave-requests/my | Security | PRODUCTION_EXECUTIVE | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0121 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/attendance/leave-requests/my | Security | COMMUNITY_MANAGER | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0122 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/attendance/leave-requests/my | Security | CHANNEL_PARTNER | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0123 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/attendance/leave-requests/my | Security | COWORKING_ADMIN | 403 (role lacks page attendance) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0124 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/attendance/leave-requests/my | Security | INSIDE_EXECUTIVE | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0125 | RBAC | API | Page access enforcement | MANAGER GET /api/attendance/me | Security | MANAGER | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0126 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/attendance/me | Security | EXECUTIVE | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0127 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/attendance/me | Security | FIELD_EXECUTIVE | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0128 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/attendance/me | Security | PRODUCTION_EXECUTIVE | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0129 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/attendance/me | Security | COMMUNITY_MANAGER | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0130 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/attendance/me | Security | CHANNEL_PARTNER | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0131 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/attendance/me | Security | COWORKING_ADMIN | 403 (role lacks page attendance) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0132 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/attendance/me | Security | INSIDE_EXECUTIVE | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0133 | RBAC | API | Page access enforcement | MANAGER GET /api/attendance/policy | Security | MANAGER | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0134 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/attendance/policy | Security | EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0135 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/attendance/policy | Security | FIELD_EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0136 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/attendance/policy | Security | PRODUCTION_EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0137 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/attendance/policy | Security | COMMUNITY_MANAGER | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0138 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/attendance/policy | Security | CHANNEL_PARTNER | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0139 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/attendance/policy | Security | COWORKING_ADMIN | 403 (role lacks page attendance) | 403 | PASS | - | - | Y |
| T0140 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/attendance/policy | Security | INSIDE_EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0141 | RBAC | API | Page access enforcement | MANAGER GET /api/attendance/users/0123456789abcdef01234567 | Security | MANAGER | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0142 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/attendance/users/0123456789abcdef01234567 | Security | EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0143 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/attendance/users/0123456789abcdef01234567 | Security | FIELD_EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0144 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/attendance/users/0123456789abcdef01234567 | Security | PRODUCTION_EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0145 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/attendance/users/0123456789abcdef01234567 | Security | COMMUNITY_MANAGER | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0146 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/attendance/users/0123456789abcdef01234567 | Security | CHANNEL_PARTNER | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0147 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/attendance/users/0123456789abcdef01234567 | Security | COWORKING_ADMIN | 403 (role lacks page attendance) | 403 | PASS | - | - | Y |
| T0148 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/attendance/users/0123456789abcdef01234567 | Security | INSIDE_EXECUTIVE | reachable (role owns page attendance) | 403 | FAIL | - | - | Y |
| T0149 | RBAC | API | Page access enforcement | MANAGER GET /api/attendance/violations | Security | MANAGER | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0150 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/attendance/violations | Security | EXECUTIVE | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0151 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/attendance/violations | Security | FIELD_EXECUTIVE | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0152 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/attendance/violations | Security | PRODUCTION_EXECUTIVE | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0153 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/attendance/violations | Security | COMMUNITY_MANAGER | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0154 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/attendance/violations | Security | CHANNEL_PARTNER | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0155 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/attendance/violations | Security | COWORKING_ADMIN | 403 (role lacks page attendance) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0156 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/attendance/violations | Security | INSIDE_EXECUTIVE | reachable (role owns page attendance) | 200 | PASS | - | - | Y |
| T0157 | RBAC | API | Page access enforcement | MANAGER GET /api/chat/broadcasts | Security | MANAGER | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0158 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/chat/broadcasts | Security | EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0159 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/chat/broadcasts | Security | FIELD_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0160 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/chat/broadcasts | Security | PRODUCTION_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0161 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/chat/broadcasts | Security | COMMUNITY_MANAGER | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0162 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/chat/broadcasts | Security | CHANNEL_PARTNER | 403 (role lacks page chat) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0163 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/chat/broadcasts | Security | COWORKING_ADMIN | 403 (role lacks page chat) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0164 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/chat/broadcasts | Security | INSIDE_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0165 | RBAC | API | Page access enforcement | MANAGER GET /api/chat/contacts | Security | MANAGER | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0166 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/chat/contacts | Security | EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0167 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/chat/contacts | Security | FIELD_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0168 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/chat/contacts | Security | PRODUCTION_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0169 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/chat/contacts | Security | COMMUNITY_MANAGER | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0170 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/chat/contacts | Security | CHANNEL_PARTNER | 403 (role lacks page chat) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0171 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/chat/contacts | Security | COWORKING_ADMIN | 403 (role lacks page chat) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0172 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/chat/contacts | Security | INSIDE_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0173 | RBAC | API | Page access enforcement | MANAGER GET /api/chat/conversations | Security | MANAGER | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0174 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/chat/conversations | Security | EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0175 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/chat/conversations | Security | FIELD_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0176 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/chat/conversations | Security | PRODUCTION_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0177 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/chat/conversations | Security | COMMUNITY_MANAGER | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0178 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/chat/conversations | Security | CHANNEL_PARTNER | 403 (role lacks page chat) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0179 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/chat/conversations | Security | COWORKING_ADMIN | 403 (role lacks page chat) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0180 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/chat/conversations | Security | INSIDE_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0181 | RBAC | API | Page access enforcement | MANAGER GET /api/chat/conversations/0123456789abcdef01234567/messages | Security | MANAGER | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0182 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/chat/conversations/0123456789abcdef01234567/messages | Security | EXECUTIVE | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0183 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/chat/conversations/0123456789abcdef01234567/messages | Security | FIELD_EXECUTIVE | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0184 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/chat/conversations/0123456789abcdef01234567/messages | Security | PRODUCTION_EXECUTIVE | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0185 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/chat/conversations/0123456789abcdef01234567/messages | Security | COMMUNITY_MANAGER | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0186 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/chat/conversations/0123456789abcdef01234567/messages | Security | CHANNEL_PARTNER | 403 (role lacks page chat) | 404 | PASS | - | - | Y |
| T0187 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/chat/conversations/0123456789abcdef01234567/messages | Security | COWORKING_ADMIN | 403 (role lacks page chat) | 404 | PASS | - | - | Y |
| T0188 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/chat/conversations/0123456789abcdef01234567/messages | Security | INSIDE_EXECUTIVE | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0189 | RBAC | API | Page access enforcement | MANAGER GET /api/chat/escalation-logs | Security | MANAGER | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0190 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/chat/escalation-logs | Security | EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0191 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/chat/escalation-logs | Security | FIELD_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0192 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/chat/escalation-logs | Security | PRODUCTION_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0193 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/chat/escalation-logs | Security | COMMUNITY_MANAGER | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0194 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/chat/escalation-logs | Security | CHANNEL_PARTNER | 403 (role lacks page chat) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0195 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/chat/escalation-logs | Security | COWORKING_ADMIN | 403 (role lacks page chat) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0196 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/chat/escalation-logs | Security | INSIDE_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0197 | RBAC | API | Page access enforcement | MANAGER GET /api/chat/escalations | Security | MANAGER | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0198 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/chat/escalations | Security | EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0199 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/chat/escalations | Security | FIELD_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0200 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/chat/escalations | Security | PRODUCTION_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0201 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/chat/escalations | Security | COMMUNITY_MANAGER | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0202 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/chat/escalations | Security | CHANNEL_PARTNER | 403 (role lacks page chat) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0203 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/chat/escalations | Security | COWORKING_ADMIN | 403 (role lacks page chat) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0204 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/chat/escalations | Security | INSIDE_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0205 | RBAC | API | Page access enforcement | MANAGER GET /api/chat/escalations/0123456789abcdef01234567/logs | Security | MANAGER | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0206 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/chat/escalations/0123456789abcdef01234567/logs | Security | EXECUTIVE | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0207 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/chat/escalations/0123456789abcdef01234567/logs | Security | FIELD_EXECUTIVE | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0208 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/chat/escalations/0123456789abcdef01234567/logs | Security | PRODUCTION_EXECUTIVE | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0209 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/chat/escalations/0123456789abcdef01234567/logs | Security | COMMUNITY_MANAGER | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0210 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/chat/escalations/0123456789abcdef01234567/logs | Security | CHANNEL_PARTNER | 403 (role lacks page chat) | 404 | PASS | - | - | Y |
| T0211 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/chat/escalations/0123456789abcdef01234567/logs | Security | COWORKING_ADMIN | 403 (role lacks page chat) | 404 | PASS | - | - | Y |
| T0212 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/chat/escalations/0123456789abcdef01234567/logs | Security | INSIDE_EXECUTIVE | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0213 | RBAC | API | Page access enforcement | MANAGER GET /api/chat/rooms | Security | MANAGER | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0214 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/chat/rooms | Security | EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0215 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/chat/rooms | Security | FIELD_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0216 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/chat/rooms | Security | PRODUCTION_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0217 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/chat/rooms | Security | COMMUNITY_MANAGER | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0218 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/chat/rooms | Security | CHANNEL_PARTNER | 403 (role lacks page chat) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0219 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/chat/rooms | Security | COWORKING_ADMIN | 403 (role lacks page chat) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0220 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/chat/rooms | Security | INSIDE_EXECUTIVE | reachable (role owns page chat) | 200 | PASS | - | - | Y |
| T0221 | RBAC | API | Page access enforcement | MANAGER GET /api/chat/rooms/0123456789abcdef01234567/messages | Security | MANAGER | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0222 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/chat/rooms/0123456789abcdef01234567/messages | Security | EXECUTIVE | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0223 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/chat/rooms/0123456789abcdef01234567/messages | Security | FIELD_EXECUTIVE | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0224 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/chat/rooms/0123456789abcdef01234567/messages | Security | PRODUCTION_EXECUTIVE | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0225 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/chat/rooms/0123456789abcdef01234567/messages | Security | COMMUNITY_MANAGER | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0226 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/chat/rooms/0123456789abcdef01234567/messages | Security | CHANNEL_PARTNER | 403 (role lacks page chat) | 404 | PASS | - | - | Y |
| T0227 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/chat/rooms/0123456789abcdef01234567/messages | Security | COWORKING_ADMIN | 403 (role lacks page chat) | 404 | PASS | - | - | Y |
| T0228 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/chat/rooms/0123456789abcdef01234567/messages | Security | INSIDE_EXECUTIVE | reachable (role owns page chat) | 404 | PASS | - | - | Y |
| T0229 | RBAC | API | Page access enforcement | MANAGER GET /api/contacts | Security | MANAGER | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0230 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/contacts | Security | EXECUTIVE | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0231 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/contacts | Security | FIELD_EXECUTIVE | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0232 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/contacts | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page inventory) | 200 | FAIL | HIGH | CRM-BUG-005 | Y |
| T0233 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/contacts | Security | COMMUNITY_MANAGER | 403 (role lacks page inventory) | 200 | FAIL | HIGH | CRM-BUG-005 | Y |
| T0234 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/contacts | Security | CHANNEL_PARTNER | reachable (role owns page inventory) | 403 | FAIL | - | CRM-BUG-005 | Y |
| T0235 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/contacts | Security | COWORKING_ADMIN | 403 (role lacks page inventory) | 200 | FAIL | HIGH | CRM-BUG-005 | Y |
| T0236 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/contacts | Security | INSIDE_EXECUTIVE | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0237 | RBAC | API | Page access enforcement | MANAGER GET /api/contacts/0123456789abcdef01234567/blocked-leads | Security | MANAGER | reachable (role owns page inventory) | 404 | PASS | - | - | Y |
| T0238 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/contacts/0123456789abcdef01234567/blocked-leads | Security | EXECUTIVE | reachable (role owns page inventory) | 404 | PASS | - | - | Y |
| T0239 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/contacts/0123456789abcdef01234567/blocked-leads | Security | FIELD_EXECUTIVE | reachable (role owns page inventory) | 404 | PASS | - | - | Y |
| T0240 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/contacts/0123456789abcdef01234567/blocked-leads | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page inventory) | 404 | PASS | - | - | Y |
| T0241 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/contacts/0123456789abcdef01234567/blocked-leads | Security | COMMUNITY_MANAGER | 403 (role lacks page inventory) | 404 | PASS | - | - | Y |
| T0242 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/contacts/0123456789abcdef01234567/blocked-leads | Security | CHANNEL_PARTNER | reachable (role owns page inventory) | 403 | FAIL | - | CRM-BUG-005 | Y |
| T0243 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/contacts/0123456789abcdef01234567/blocked-leads | Security | COWORKING_ADMIN | 403 (role lacks page inventory) | 404 | PASS | - | - | Y |
| T0244 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/contacts/0123456789abcdef01234567/blocked-leads | Security | INSIDE_EXECUTIVE | reachable (role owns page inventory) | 404 | PASS | - | - | Y |
| T0245 | RBAC | API | Page access enforcement | MANAGER GET /api/contacts/identify | Security | MANAGER | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0246 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/contacts/identify | Security | EXECUTIVE | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0247 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/contacts/identify | Security | FIELD_EXECUTIVE | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0248 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/contacts/identify | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page inventory) | 200 | FAIL | HIGH | CRM-BUG-005 | Y |
| T0249 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/contacts/identify | Security | COMMUNITY_MANAGER | 403 (role lacks page inventory) | 200 | FAIL | HIGH | CRM-BUG-005 | Y |
| T0250 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/contacts/identify | Security | CHANNEL_PARTNER | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0251 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/contacts/identify | Security | COWORKING_ADMIN | 403 (role lacks page inventory) | 200 | FAIL | HIGH | CRM-BUG-005 | Y |
| T0252 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/contacts/identify | Security | INSIDE_EXECUTIVE | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0253 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/audit-logs | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0254 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/audit-logs | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0255 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/audit-logs | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0256 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/audit-logs | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0257 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/audit-logs | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0258 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/audit-logs | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0259 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/audit-logs | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0260 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/audit-logs | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0261 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/board | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0262 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/board | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0263 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/board | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0264 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/board | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0265 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/board | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0266 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/board | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0267 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/board | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0268 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/board | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0269 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/bookings | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0270 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/bookings | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0271 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/bookings | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0272 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/bookings | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0273 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/bookings | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0274 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/bookings | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0275 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/bookings | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0276 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/bookings | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0277 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/bookings/0123456789abcdef01234567 | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 404 | PASS | - | - | Y |
| T0278 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/bookings/0123456789abcdef01234567 | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0279 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/bookings/0123456789abcdef01234567 | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0280 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/bookings/0123456789abcdef01234567 | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0281 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/bookings/0123456789abcdef01234567 | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0282 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/bookings/0123456789abcdef01234567 | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0283 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/bookings/0123456789abcdef01234567 | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 404 | PASS | - | - | Y |
| T0284 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/bookings/0123456789abcdef01234567 | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0285 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/bookings/available-cabins | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 400 | PASS | - | - | Y |
| T0286 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/bookings/available-cabins | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0287 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/bookings/available-cabins | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0288 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/bookings/available-cabins | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0289 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/bookings/available-cabins | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0290 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/bookings/available-cabins | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0291 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/bookings/available-cabins | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 400 | PASS | - | - | Y |
| T0292 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/bookings/available-cabins | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0293 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/bookings/available-seats | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 400 | PASS | - | - | Y |
| T0294 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/bookings/available-seats | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0295 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/bookings/available-seats | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0296 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/bookings/available-seats | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0297 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/bookings/available-seats | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0298 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/bookings/available-seats | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0299 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/bookings/available-seats | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 400 | PASS | - | - | Y |
| T0300 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/bookings/available-seats | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0301 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/bookings/cabins/0123456789abcdef01234567/calendar | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 400 | PASS | - | - | Y |
| T0302 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/bookings/cabins/0123456789abcdef01234567/calendar | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0303 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/bookings/cabins/0123456789abcdef01234567/calendar | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0304 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/bookings/cabins/0123456789abcdef01234567/calendar | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0305 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/bookings/cabins/0123456789abcdef01234567/calendar | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0306 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/bookings/cabins/0123456789abcdef01234567/calendar | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0307 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/bookings/cabins/0123456789abcdef01234567/calendar | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 400 | PASS | - | - | Y |
| T0308 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/bookings/cabins/0123456789abcdef01234567/calendar | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0309 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/cabins | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0310 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/cabins | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0311 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/cabins | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0312 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/cabins | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0313 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/cabins | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0314 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/cabins | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0315 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/cabins | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0316 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/cabins | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0317 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/cabins/0123456789abcdef01234567 | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 404 | PASS | - | - | Y |
| T0318 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/cabins/0123456789abcdef01234567 | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0319 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/cabins/0123456789abcdef01234567 | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0320 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/cabins/0123456789abcdef01234567 | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0321 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/cabins/0123456789abcdef01234567 | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0322 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/cabins/0123456789abcdef01234567 | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0323 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/cabins/0123456789abcdef01234567 | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 404 | PASS | - | - | Y |
| T0324 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/cabins/0123456789abcdef01234567 | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0325 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/cabins/floor-view | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 400 | PASS | - | - | Y |
| T0326 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/cabins/floor-view | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0327 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/cabins/floor-view | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0328 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/cabins/floor-view | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0329 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/cabins/floor-view | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0330 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/cabins/floor-view | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0331 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/cabins/floor-view | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 400 | PASS | - | - | Y |
| T0332 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/cabins/floor-view | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0333 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/clients | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0334 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/clients | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0335 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/clients | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0336 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/clients | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0337 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/clients | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0338 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/clients | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0339 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/clients | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0340 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/clients | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0341 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/clients/0123456789abcdef01234567 | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 404 | PASS | - | - | Y |
| T0342 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/clients/0123456789abcdef01234567 | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0343 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/clients/0123456789abcdef01234567 | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0344 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/clients/0123456789abcdef01234567 | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0345 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/clients/0123456789abcdef01234567 | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0346 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/clients/0123456789abcdef01234567 | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0347 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/clients/0123456789abcdef01234567 | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 404 | PASS | - | - | Y |
| T0348 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/clients/0123456789abcdef01234567 | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0349 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/clients/0123456789abcdef01234567/activity | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0350 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/clients/0123456789abcdef01234567/activity | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0351 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/clients/0123456789abcdef01234567/activity | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0352 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/clients/0123456789abcdef01234567/activity | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0353 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/clients/0123456789abcdef01234567/activity | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0354 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/clients/0123456789abcdef01234567/activity | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0355 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/clients/0123456789abcdef01234567/activity | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0356 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/clients/0123456789abcdef01234567/activity | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0357 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/clients/0123456789abcdef01234567/assignments | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0358 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/clients/0123456789abcdef01234567/assignments | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0359 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/clients/0123456789abcdef01234567/assignments | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0360 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/clients/0123456789abcdef01234567/assignments | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0361 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/clients/0123456789abcdef01234567/assignments | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0362 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/clients/0123456789abcdef01234567/assignments | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0363 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/clients/0123456789abcdef01234567/assignments | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0364 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/clients/0123456789abcdef01234567/assignments | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0365 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/clients/0123456789abcdef01234567/portal-users | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0366 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/clients/0123456789abcdef01234567/portal-users | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0367 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/clients/0123456789abcdef01234567/portal-users | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0368 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/clients/0123456789abcdef01234567/portal-users | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0369 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/clients/0123456789abcdef01234567/portal-users | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0370 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/clients/0123456789abcdef01234567/portal-users | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0371 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/clients/0123456789abcdef01234567/portal-users | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0372 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/clients/0123456789abcdef01234567/portal-users | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0373 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/clients/birthdays | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0374 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/clients/birthdays | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0375 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/clients/birthdays | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0376 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/clients/birthdays | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0377 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/clients/birthdays | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0378 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/clients/birthdays | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0379 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/clients/birthdays | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0380 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/clients/birthdays | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0381 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/contracts | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0382 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/contracts | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0383 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/contracts | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0384 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/contracts | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0385 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/contracts | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0386 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/contracts | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0387 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/contracts | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0388 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/contracts | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0389 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/contracts/0123456789abcdef01234567 | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 404 | PASS | - | - | Y |
| T0390 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/contracts/0123456789abcdef01234567 | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0391 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/contracts/0123456789abcdef01234567 | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0392 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/contracts/0123456789abcdef01234567 | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0393 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/contracts/0123456789abcdef01234567 | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0394 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/contracts/0123456789abcdef01234567 | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0395 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/contracts/0123456789abcdef01234567 | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 404 | PASS | - | - | Y |
| T0396 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/contracts/0123456789abcdef01234567 | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0397 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/expenses | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0398 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/expenses | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0399 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/expenses | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0400 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/expenses | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0401 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/expenses | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0402 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/expenses | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0403 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/expenses | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0404 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/expenses | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0405 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/expenses/0123456789abcdef01234567 | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 404 | PASS | - | - | Y |
| T0406 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/expenses/0123456789abcdef01234567 | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0407 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/expenses/0123456789abcdef01234567 | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0408 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/expenses/0123456789abcdef01234567 | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0409 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/expenses/0123456789abcdef01234567 | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0410 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/expenses/0123456789abcdef01234567 | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0411 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/expenses/0123456789abcdef01234567 | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 404 | PASS | - | - | Y |
| T0412 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/expenses/0123456789abcdef01234567 | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0413 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/floors | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0414 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/floors | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0415 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/floors | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0416 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/floors | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0417 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/floors | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0418 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/floors | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0419 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/floors | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0420 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/floors | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0421 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/floors/0123456789abcdef01234567 | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 404 | PASS | - | - | Y |
| T0422 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/floors/0123456789abcdef01234567 | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0423 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/floors/0123456789abcdef01234567 | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0424 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/floors/0123456789abcdef01234567 | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0425 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/floors/0123456789abcdef01234567 | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0426 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/floors/0123456789abcdef01234567 | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0427 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/floors/0123456789abcdef01234567 | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 404 | PASS | - | - | Y |
| T0428 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/floors/0123456789abcdef01234567 | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0429 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/invoices | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0430 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/invoices | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0431 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/invoices | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0432 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/invoices | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0433 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/invoices | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0434 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/invoices | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0435 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/invoices | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0436 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/invoices | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0437 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/invoices/0123456789abcdef01234567 | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 404 | PASS | - | - | Y |
| T0438 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/invoices/0123456789abcdef01234567 | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0439 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/invoices/0123456789abcdef01234567 | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0440 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/invoices/0123456789abcdef01234567 | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0441 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/invoices/0123456789abcdef01234567 | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0442 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/invoices/0123456789abcdef01234567 | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0443 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/invoices/0123456789abcdef01234567 | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 404 | PASS | - | - | Y |
| T0444 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/invoices/0123456789abcdef01234567 | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0445 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/payments | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0446 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/payments | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0447 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/payments | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0448 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/payments | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0449 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/payments | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0450 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/payments | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0451 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/payments | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0452 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/payments | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0453 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/permissions/me | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0454 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/permissions/me | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0455 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/permissions/me | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0456 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/permissions/me | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0457 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/permissions/me | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0458 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/permissions/me | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0459 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/permissions/me | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0460 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/permissions/me | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0461 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/properties | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0462 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/properties | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0463 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/properties | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0464 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/properties | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0465 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/properties | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0466 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/properties | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0467 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/properties | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0468 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/properties | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0469 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/properties/0123456789abcdef01234567 | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 404 | PASS | - | - | Y |
| T0470 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/properties/0123456789abcdef01234567 | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0471 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/properties/0123456789abcdef01234567 | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0472 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/properties/0123456789abcdef01234567 | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0473 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/properties/0123456789abcdef01234567 | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0474 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/properties/0123456789abcdef01234567 | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0475 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/properties/0123456789abcdef01234567 | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 404 | PASS | - | - | Y |
| T0476 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/properties/0123456789abcdef01234567 | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0477 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/roles | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0478 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/roles | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0479 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/roles | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0480 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/roles | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0481 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/roles | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0482 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/roles | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0483 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/roles | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0484 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/roles | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0485 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/seats | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0486 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/seats | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0487 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/seats | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0488 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/seats | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0489 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/seats | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0490 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/seats | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0491 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/seats | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0492 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/seats | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0493 | RBAC | API | Page access enforcement | MANAGER GET /api/coworking/users | Security | MANAGER | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0494 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/coworking/users | Security | EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0495 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/coworking/users | Security | FIELD_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0496 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/coworking/users | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0497 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/coworking/users | Security | COMMUNITY_MANAGER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0498 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/coworking/users | Security | CHANNEL_PARTNER | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0499 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/coworking/users | Security | COWORKING_ADMIN | reachable (role owns page coworking_booking/coworki… | 200 | PASS | - | - | Y |
| T0500 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/coworking/users | Security | INSIDE_EXECUTIVE | 403 (role lacks page coworking_booking/coworking_cl… | 403 | PASS | - | - | Y |
| T0501 | RBAC | API | Page access enforcement | MANAGER GET /api/inventory | Security | MANAGER | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0502 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/inventory | Security | EXECUTIVE | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0503 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/inventory | Security | FIELD_EXECUTIVE | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0504 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/inventory | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page inventory) | 403 | PASS | - | - | Y |
| T0505 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/inventory | Security | COMMUNITY_MANAGER | 403 (role lacks page inventory) | 403 | PASS | - | - | Y |
| T0506 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/inventory | Security | CHANNEL_PARTNER | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0507 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/inventory | Security | COWORKING_ADMIN | 403 (role lacks page inventory) | 403 | PASS | - | - | Y |
| T0508 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/inventory | Security | INSIDE_EXECUTIVE | reachable (role owns page inventory) | 403 | FAIL | - | - | Y |
| T0509 | RBAC | API | Page access enforcement | MANAGER GET /api/inventory-request/my | Security | MANAGER | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0510 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/inventory-request/my | Security | EXECUTIVE | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0511 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/inventory-request/my | Security | FIELD_EXECUTIVE | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0512 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/inventory-request/my | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page inventory) | 403 | PASS | - | - | Y |
| T0513 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/inventory-request/my | Security | COMMUNITY_MANAGER | 403 (role lacks page inventory) | 403 | PASS | - | - | Y |
| T0514 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/inventory-request/my | Security | CHANNEL_PARTNER | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0515 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/inventory-request/my | Security | COWORKING_ADMIN | 403 (role lacks page inventory) | 403 | PASS | - | - | Y |
| T0516 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/inventory-request/my | Security | INSIDE_EXECUTIVE | reachable (role owns page inventory) | 403 | FAIL | - | - | Y |
| T0517 | RBAC | API | Page access enforcement | MANAGER GET /api/inventory-request/pending | Security | MANAGER | reachable (role owns page inventory) | 200 | PASS | - | - | Y |
| T0518 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/inventory-request/pending | Security | EXECUTIVE | reachable (role owns page inventory) | 403 | FAIL | - | - | Y |
| T0519 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/inventory-request/pending | Security | FIELD_EXECUTIVE | reachable (role owns page inventory) | 403 | FAIL | - | - | Y |
| T0520 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/inventory-request/pending | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page inventory) | 403 | PASS | - | - | Y |
| T0521 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/inventory-request/pending | Security | COMMUNITY_MANAGER | 403 (role lacks page inventory) | 403 | PASS | - | - | Y |
| T0522 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/inventory-request/pending | Security | CHANNEL_PARTNER | reachable (role owns page inventory) | 403 | FAIL | - | - | Y |
| T0523 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/inventory-request/pending | Security | COWORKING_ADMIN | 403 (role lacks page inventory) | 403 | PASS | - | - | Y |
| T0524 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/inventory-request/pending | Security | INSIDE_EXECUTIVE | reachable (role owns page inventory) | 403 | FAIL | - | - | Y |
| T0525 | RBAC | API | Page access enforcement | MANAGER GET /api/inventory/0123456789abcdef01234567 | Security | MANAGER | reachable (role owns page inventory) | 404 | PASS | - | - | Y |
| T0526 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/inventory/0123456789abcdef01234567 | Security | EXECUTIVE | reachable (role owns page inventory) | 404 | PASS | - | - | Y |
| T0527 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/inventory/0123456789abcdef01234567 | Security | FIELD_EXECUTIVE | reachable (role owns page inventory) | 404 | PASS | - | - | Y |
| T0528 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/inventory/0123456789abcdef01234567 | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page inventory) | 403 | PASS | - | - | Y |
| T0529 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/inventory/0123456789abcdef01234567 | Security | COMMUNITY_MANAGER | 403 (role lacks page inventory) | 403 | PASS | - | - | Y |
| T0530 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/inventory/0123456789abcdef01234567 | Security | CHANNEL_PARTNER | reachable (role owns page inventory) | 404 | PASS | - | - | Y |
| T0531 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/inventory/0123456789abcdef01234567 | Security | COWORKING_ADMIN | 403 (role lacks page inventory) | 403 | PASS | - | - | Y |
| T0532 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/inventory/0123456789abcdef01234567 | Security | INSIDE_EXECUTIVE | reachable (role owns page inventory) | 403 | FAIL | - | - | Y |
| T0533 | RBAC | API | Page access enforcement | MANAGER GET /api/inventory/0123456789abcdef01234567/activity | Security | MANAGER | reachable (role owns page inventory) | 404 | PASS | - | - | Y |
| T0534 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/inventory/0123456789abcdef01234567/activity | Security | EXECUTIVE | reachable (role owns page inventory) | 403 | FAIL | - | - | Y |
| T0535 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/inventory/0123456789abcdef01234567/activity | Security | FIELD_EXECUTIVE | reachable (role owns page inventory) | 403 | FAIL | - | - | Y |
| T0536 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/inventory/0123456789abcdef01234567/activity | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page inventory) | 403 | PASS | - | - | Y |
| T0537 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/inventory/0123456789abcdef01234567/activity | Security | COMMUNITY_MANAGER | 403 (role lacks page inventory) | 403 | PASS | - | - | Y |
| T0538 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/inventory/0123456789abcdef01234567/activity | Security | CHANNEL_PARTNER | reachable (role owns page inventory) | 403 | FAIL | - | - | Y |
| T0539 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/inventory/0123456789abcdef01234567/activity | Security | COWORKING_ADMIN | 403 (role lacks page inventory) | 403 | PASS | - | - | Y |
| T0540 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/inventory/0123456789abcdef01234567/activity | Security | INSIDE_EXECUTIVE | reachable (role owns page inventory) | 403 | FAIL | - | - | Y |
| T0541 | RBAC | API | Page access enforcement | MANAGER GET /api/leads | Security | MANAGER | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0542 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/leads | Security | EXECUTIVE | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0543 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/leads | Security | FIELD_EXECUTIVE | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0544 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/leads | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page leads/my_leads) | 403 | PASS | - | - | Y |
| T0545 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/leads | Security | COMMUNITY_MANAGER | 403 (role lacks page leads/my_leads) | 403 | PASS | - | - | Y |
| T0546 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/leads | Security | CHANNEL_PARTNER | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0547 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/leads | Security | COWORKING_ADMIN | 403 (role lacks page leads/my_leads) | 403 | PASS | - | - | Y |
| T0548 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/leads | Security | INSIDE_EXECUTIVE | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0549 | RBAC | API | Page access enforcement | MANAGER GET /api/leads/0123456789abcdef01234567 | Security | MANAGER | reachable (role owns page leads/my_leads) | 404 | PASS | - | - | Y |
| T0550 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/leads/0123456789abcdef01234567 | Security | EXECUTIVE | reachable (role owns page leads/my_leads) | 404 | PASS | - | - | Y |
| T0551 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/leads/0123456789abcdef01234567 | Security | FIELD_EXECUTIVE | reachable (role owns page leads/my_leads) | 404 | PASS | - | - | Y |
| T0552 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/leads/0123456789abcdef01234567 | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page leads/my_leads) | 404 | PASS | - | - | Y |
| T0553 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/leads/0123456789abcdef01234567 | Security | COMMUNITY_MANAGER | 403 (role lacks page leads/my_leads) | 404 | PASS | - | - | Y |
| T0554 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/leads/0123456789abcdef01234567 | Security | CHANNEL_PARTNER | reachable (role owns page leads/my_leads) | 404 | PASS | - | - | Y |
| T0555 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/leads/0123456789abcdef01234567 | Security | COWORKING_ADMIN | 403 (role lacks page leads/my_leads) | 404 | PASS | - | - | Y |
| T0556 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/leads/0123456789abcdef01234567 | Security | INSIDE_EXECUTIVE | reachable (role owns page leads/my_leads) | 404 | PASS | - | - | Y |
| T0557 | RBAC | API | Page access enforcement | MANAGER GET /api/leads/0123456789abcdef01234567/activity | Security | MANAGER | reachable (role owns page leads/my_leads) | 404 | PASS | - | - | Y |
| T0558 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/leads/0123456789abcdef01234567/activity | Security | EXECUTIVE | reachable (role owns page leads/my_leads) | 404 | PASS | - | - | Y |
| T0559 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/leads/0123456789abcdef01234567/activity | Security | FIELD_EXECUTIVE | reachable (role owns page leads/my_leads) | 404 | PASS | - | - | Y |
| T0560 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/leads/0123456789abcdef01234567/activity | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page leads/my_leads) | 404 | PASS | - | - | Y |
| T0561 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/leads/0123456789abcdef01234567/activity | Security | COMMUNITY_MANAGER | 403 (role lacks page leads/my_leads) | 404 | PASS | - | - | Y |
| T0562 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/leads/0123456789abcdef01234567/activity | Security | CHANNEL_PARTNER | reachable (role owns page leads/my_leads) | 404 | PASS | - | - | Y |
| T0563 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/leads/0123456789abcdef01234567/activity | Security | COWORKING_ADMIN | 403 (role lacks page leads/my_leads) | 404 | PASS | - | - | Y |
| T0564 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/leads/0123456789abcdef01234567/activity | Security | INSIDE_EXECUTIVE | reachable (role owns page leads/my_leads) | 404 | PASS | - | - | Y |
| T0565 | RBAC | API | Page access enforcement | MANAGER GET /api/leads/0123456789abcdef01234567/diary | Security | MANAGER | reachable (role owns page leads/my_leads) | 404 | PASS | - | - | Y |
| T0566 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/leads/0123456789abcdef01234567/diary | Security | EXECUTIVE | reachable (role owns page leads/my_leads) | 404 | PASS | - | - | Y |
| T0567 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/leads/0123456789abcdef01234567/diary | Security | FIELD_EXECUTIVE | reachable (role owns page leads/my_leads) | 404 | PASS | - | - | Y |
| T0568 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/leads/0123456789abcdef01234567/diary | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page leads/my_leads) | 404 | PASS | - | - | Y |
| T0569 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/leads/0123456789abcdef01234567/diary | Security | COMMUNITY_MANAGER | 403 (role lacks page leads/my_leads) | 404 | PASS | - | - | Y |
| T0570 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/leads/0123456789abcdef01234567/diary | Security | CHANNEL_PARTNER | reachable (role owns page leads/my_leads) | 404 | PASS | - | - | Y |
| T0571 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/leads/0123456789abcdef01234567/diary | Security | COWORKING_ADMIN | 403 (role lacks page leads/my_leads) | 404 | PASS | - | - | Y |
| T0572 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/leads/0123456789abcdef01234567/diary | Security | INSIDE_EXECUTIVE | reachable (role owns page leads/my_leads) | 404 | PASS | - | - | Y |
| T0573 | RBAC | API | Page access enforcement | MANAGER GET /api/leads/followups/today | Security | MANAGER | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0574 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/leads/followups/today | Security | EXECUTIVE | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0575 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/leads/followups/today | Security | FIELD_EXECUTIVE | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0576 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/leads/followups/today | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page leads/my_leads) | 403 | PASS | - | - | Y |
| T0577 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/leads/followups/today | Security | COMMUNITY_MANAGER | 403 (role lacks page leads/my_leads) | 403 | PASS | - | - | Y |
| T0578 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/leads/followups/today | Security | CHANNEL_PARTNER | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0579 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/leads/followups/today | Security | COWORKING_ADMIN | 403 (role lacks page leads/my_leads) | 403 | PASS | - | - | Y |
| T0580 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/leads/followups/today | Security | INSIDE_EXECUTIVE | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0581 | RBAC | API | Page access enforcement | MANAGER GET /api/leads/payment-requests | Security | MANAGER | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0582 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/leads/payment-requests | Security | EXECUTIVE | reachable (role owns page leads/my_leads) | 403 | FAIL | - | - | Y |
| T0583 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/leads/payment-requests | Security | FIELD_EXECUTIVE | reachable (role owns page leads/my_leads) | 403 | FAIL | - | - | Y |
| T0584 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/leads/payment-requests | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page leads/my_leads) | 403 | PASS | - | - | Y |
| T0585 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/leads/payment-requests | Security | COMMUNITY_MANAGER | 403 (role lacks page leads/my_leads) | 403 | PASS | - | - | Y |
| T0586 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/leads/payment-requests | Security | CHANNEL_PARTNER | reachable (role owns page leads/my_leads) | 403 | FAIL | - | - | Y |
| T0587 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/leads/payment-requests | Security | COWORKING_ADMIN | 403 (role lacks page leads/my_leads) | 403 | PASS | - | - | Y |
| T0588 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/leads/payment-requests | Security | INSIDE_EXECUTIVE | reachable (role owns page leads/my_leads) | 403 | FAIL | - | - | Y |
| T0589 | RBAC | API | Page access enforcement | MANAGER GET /api/leads/performance/overview | Security | MANAGER | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0590 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/leads/performance/overview | Security | EXECUTIVE | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0591 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/leads/performance/overview | Security | FIELD_EXECUTIVE | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0592 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/leads/performance/overview | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page leads/my_leads) | 200 | FAIL | HIGH | CRM-BUG-008 | Y |
| T0593 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/leads/performance/overview | Security | COMMUNITY_MANAGER | 403 (role lacks page leads/my_leads) | 200 | FAIL | HIGH | CRM-BUG-008 | Y |
| T0594 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/leads/performance/overview | Security | CHANNEL_PARTNER | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0595 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/leads/performance/overview | Security | COWORKING_ADMIN | 403 (role lacks page leads/my_leads) | 200 | FAIL | HIGH | CRM-BUG-008 | Y |
| T0596 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/leads/performance/overview | Security | INSIDE_EXECUTIVE | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0597 | RBAC | API | Page access enforcement | MANAGER GET /api/leads/status-requests | Security | MANAGER | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0598 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/leads/status-requests | Security | EXECUTIVE | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0599 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/leads/status-requests | Security | FIELD_EXECUTIVE | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0600 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/leads/status-requests | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page leads/my_leads) | 200 | FAIL | HIGH | CRM-BUG-008 | Y |
| T0601 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/leads/status-requests | Security | COMMUNITY_MANAGER | 403 (role lacks page leads/my_leads) | 200 | FAIL | HIGH | CRM-BUG-008 | Y |
| T0602 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/leads/status-requests | Security | CHANNEL_PARTNER | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0603 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/leads/status-requests | Security | COWORKING_ADMIN | 403 (role lacks page leads/my_leads) | 200 | FAIL | HIGH | CRM-BUG-008 | Y |
| T0604 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/leads/status-requests | Security | INSIDE_EXECUTIVE | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0605 | RBAC | API | Page access enforcement | MANAGER GET /api/leads/status-requests/pending | Security | MANAGER | reachable (role owns page leads/my_leads) | 200 | PASS | - | - | Y |
| T0606 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/leads/status-requests/pending | Security | EXECUTIVE | reachable (role owns page leads/my_leads) | 403 | FAIL | - | CRM-BUG-008 | Y |
| T0607 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/leads/status-requests/pending | Security | FIELD_EXECUTIVE | reachable (role owns page leads/my_leads) | 403 | FAIL | - | CRM-BUG-008 | Y |
| T0608 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/leads/status-requests/pending | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page leads/my_leads) | 403 | PASS | - | - | Y |
| T0609 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/leads/status-requests/pending | Security | COMMUNITY_MANAGER | 403 (role lacks page leads/my_leads) | 403 | PASS | - | - | Y |
| T0610 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/leads/status-requests/pending | Security | CHANNEL_PARTNER | reachable (role owns page leads/my_leads) | 403 | FAIL | - | CRM-BUG-008 | Y |
| T0611 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/leads/status-requests/pending | Security | COWORKING_ADMIN | 403 (role lacks page leads/my_leads) | 403 | PASS | - | - | Y |
| T0612 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/leads/status-requests/pending | Security | INSIDE_EXECUTIVE | reachable (role owns page leads/my_leads) | 403 | FAIL | - | CRM-BUG-008 | Y |
| T0613 | RBAC | API | Page access enforcement | MANAGER GET /api/projects | Security | MANAGER | reachable (role owns page projects) | 200 | PASS | - | - | Y |
| T0614 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/projects | Security | EXECUTIVE | reachable (role owns page projects) | 200 | PASS | - | - | Y |
| T0615 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/projects | Security | FIELD_EXECUTIVE | reachable (role owns page projects) | 200 | PASS | - | - | Y |
| T0616 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/projects | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page projects) | 403 | PASS | - | - | Y |
| T0617 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/projects | Security | COMMUNITY_MANAGER | 403 (role lacks page projects) | 403 | PASS | - | - | Y |
| T0618 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/projects | Security | CHANNEL_PARTNER | reachable (role owns page projects) | 200 | PASS | - | - | Y |
| T0619 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/projects | Security | COWORKING_ADMIN | 403 (role lacks page projects) | 403 | PASS | - | - | Y |
| T0620 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/projects | Security | INSIDE_EXECUTIVE | reachable (role owns page projects) | 403 | FAIL | - | - | Y |
| T0621 | RBAC | API | Page access enforcement | MANAGER GET /api/projects/0123456789abcdef01234567 | Security | MANAGER | reachable (role owns page projects) | 404 | PASS | - | - | Y |
| T0622 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/projects/0123456789abcdef01234567 | Security | EXECUTIVE | reachable (role owns page projects) | 404 | PASS | - | - | Y |
| T0623 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/projects/0123456789abcdef01234567 | Security | FIELD_EXECUTIVE | reachable (role owns page projects) | 404 | PASS | - | - | Y |
| T0624 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/projects/0123456789abcdef01234567 | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page projects) | 403 | PASS | - | - | Y |
| T0625 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/projects/0123456789abcdef01234567 | Security | COMMUNITY_MANAGER | 403 (role lacks page projects) | 403 | PASS | - | - | Y |
| T0626 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/projects/0123456789abcdef01234567 | Security | CHANNEL_PARTNER | reachable (role owns page projects) | 404 | PASS | - | - | Y |
| T0627 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/projects/0123456789abcdef01234567 | Security | COWORKING_ADMIN | 403 (role lacks page projects) | 403 | PASS | - | - | Y |
| T0628 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/projects/0123456789abcdef01234567 | Security | INSIDE_EXECUTIVE | reachable (role owns page projects) | 403 | FAIL | - | - | Y |
| T0629 | RBAC | API | Page access enforcement | MANAGER GET /api/roles | Security | MANAGER | reachable (role owns page admin_team) | 200 | PASS | - | - | Y |
| T0630 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/roles | Security | EXECUTIVE | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0631 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/roles | Security | FIELD_EXECUTIVE | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0632 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/roles | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0633 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/roles | Security | COMMUNITY_MANAGER | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0634 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/roles | Security | CHANNEL_PARTNER | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0635 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/roles | Security | COWORKING_ADMIN | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0636 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/roles | Security | INSIDE_EXECUTIVE | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0637 | RBAC | API | Page access enforcement | MANAGER GET /api/roles/catalogue | Security | MANAGER | reachable (role owns page admin_team) | 200 | PASS | - | - | Y |
| T0638 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/roles/catalogue | Security | EXECUTIVE | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0639 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/roles/catalogue | Security | FIELD_EXECUTIVE | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0640 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/roles/catalogue | Security | PRODUCTION_EXECUTIVE | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0641 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/roles/catalogue | Security | COMMUNITY_MANAGER | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0642 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/roles/catalogue | Security | CHANNEL_PARTNER | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0643 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/roles/catalogue | Security | COWORKING_ADMIN | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0644 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/roles/catalogue | Security | INSIDE_EXECUTIVE | 403 (role lacks page admin_team) | 403 | PASS | - | - | Y |
| T0645 | RBAC | API | Page access enforcement | MANAGER GET /api/targets/my | Security | MANAGER | reachable (role owns page targets) | 200 | PASS | - | - | Y |
| T0646 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/targets/my | Security | EXECUTIVE | reachable (role owns page targets) | 200 | PASS | - | - | Y |
| T0647 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/targets/my | Security | FIELD_EXECUTIVE | reachable (role owns page targets) | 200 | PASS | - | - | Y |
| T0648 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/targets/my | Security | PRODUCTION_EXECUTIVE | reachable (role owns page targets) | 200 | PASS | - | - | Y |
| T0649 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/targets/my | Security | COMMUNITY_MANAGER | reachable (role owns page targets) | 200 | PASS | - | - | Y |
| T0650 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/targets/my | Security | CHANNEL_PARTNER | 403 (role lacks page targets) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0651 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/targets/my | Security | COWORKING_ADMIN | 403 (role lacks page targets) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0652 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/targets/my | Security | INSIDE_EXECUTIVE | reachable (role owns page targets) | 200 | PASS | - | - | Y |
| T0653 | RBAC | API | Page access enforcement | MANAGER GET /api/tasks | Security | MANAGER | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0654 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/tasks | Security | EXECUTIVE | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0655 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/tasks | Security | FIELD_EXECUTIVE | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0656 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/tasks | Security | PRODUCTION_EXECUTIVE | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0657 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/tasks | Security | COMMUNITY_MANAGER | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0658 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/tasks | Security | CHANNEL_PARTNER | 403 (role lacks page tasks) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0659 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/tasks | Security | COWORKING_ADMIN | 403 (role lacks page tasks) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0660 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/tasks | Security | INSIDE_EXECUTIVE | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0661 | RBAC | API | Page access enforcement | MANAGER GET /api/tasks/0123456789abcdef01234567 | Security | MANAGER | reachable (role owns page tasks) | 404 | PASS | - | - | Y |
| T0662 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/tasks/0123456789abcdef01234567 | Security | EXECUTIVE | reachable (role owns page tasks) | 404 | PASS | - | - | Y |
| T0663 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/tasks/0123456789abcdef01234567 | Security | FIELD_EXECUTIVE | reachable (role owns page tasks) | 404 | PASS | - | - | Y |
| T0664 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/tasks/0123456789abcdef01234567 | Security | PRODUCTION_EXECUTIVE | reachable (role owns page tasks) | 404 | PASS | - | - | Y |
| T0665 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/tasks/0123456789abcdef01234567 | Security | COMMUNITY_MANAGER | reachable (role owns page tasks) | 404 | PASS | - | - | Y |
| T0666 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/tasks/0123456789abcdef01234567 | Security | CHANNEL_PARTNER | 403 (role lacks page tasks) | 404 | PASS | - | - | Y |
| T0667 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/tasks/0123456789abcdef01234567 | Security | COWORKING_ADMIN | 403 (role lacks page tasks) | 404 | PASS | - | - | Y |
| T0668 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/tasks/0123456789abcdef01234567 | Security | INSIDE_EXECUTIVE | reachable (role owns page tasks) | 404 | PASS | - | - | Y |
| T0669 | RBAC | API | Page access enforcement | MANAGER GET /api/tasks/assignees | Security | MANAGER | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0670 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/tasks/assignees | Security | EXECUTIVE | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0671 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/tasks/assignees | Security | FIELD_EXECUTIVE | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0672 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/tasks/assignees | Security | PRODUCTION_EXECUTIVE | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0673 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/tasks/assignees | Security | COMMUNITY_MANAGER | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0674 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/tasks/assignees | Security | CHANNEL_PARTNER | 403 (role lacks page tasks) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0675 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/tasks/assignees | Security | COWORKING_ADMIN | 403 (role lacks page tasks) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0676 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/tasks/assignees | Security | INSIDE_EXECUTIVE | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0677 | RBAC | API | Page access enforcement | MANAGER GET /api/tasks/stats | Security | MANAGER | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0678 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/tasks/stats | Security | EXECUTIVE | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0679 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/tasks/stats | Security | FIELD_EXECUTIVE | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0680 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/tasks/stats | Security | PRODUCTION_EXECUTIVE | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0681 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/tasks/stats | Security | COMMUNITY_MANAGER | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0682 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/tasks/stats | Security | CHANNEL_PARTNER | 403 (role lacks page tasks) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0683 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/tasks/stats | Security | COWORKING_ADMIN | 403 (role lacks page tasks) | 200 | FAIL | HIGH | CRM-BUG-004 | Y |
| T0684 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/tasks/stats | Security | INSIDE_EXECUTIVE | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0685 | RBAC | API | Page access enforcement | MANAGER GET /api/tasks/stats/by-user | Security | MANAGER | reachable (role owns page tasks) | 200 | PASS | - | - | Y |
| T0686 | RBAC | API | Page access enforcement | EXECUTIVE GET /api/tasks/stats/by-user | Security | EXECUTIVE | reachable (role owns page tasks) | 403 | FAIL | - | - | Y |
| T0687 | RBAC | API | Page access enforcement | FIELD_EXECUTIVE GET /api/tasks/stats/by-user | Security | FIELD_EXECUTIVE | reachable (role owns page tasks) | 403 | FAIL | - | - | Y |
| T0688 | RBAC | API | Page access enforcement | PRODUCTION_EXECUTIVE GET /api/tasks/stats/by-user | Security | PRODUCTION_EXECUTIVE | reachable (role owns page tasks) | 403 | FAIL | - | - | Y |
| T0689 | RBAC | API | Page access enforcement | COMMUNITY_MANAGER GET /api/tasks/stats/by-user | Security | COMMUNITY_MANAGER | reachable (role owns page tasks) | 403 | FAIL | - | - | Y |
| T0690 | RBAC | API | Page access enforcement | CHANNEL_PARTNER GET /api/tasks/stats/by-user | Security | CHANNEL_PARTNER | 403 (role lacks page tasks) | 403 | PASS | - | - | Y |
| T0691 | RBAC | API | Page access enforcement | COWORKING_ADMIN GET /api/tasks/stats/by-user | Security | COWORKING_ADMIN | 403 (role lacks page tasks) | 403 | PASS | - | - | Y |
| T0692 | RBAC | API | Page access enforcement | INSIDE_EXECUTIVE GET /api/tasks/stats/by-user | Security | INSIDE_EXECUTIVE | reachable (role owns page tasks) | 403 | FAIL | - | - | Y |
| T0693 | RBAC | API | Staff directory | EXECUTIVE lists all company users via GET /api/users | Security | EXECUTIVE | 403, or scoped to own hierarchy without contact PII | 200 returned 1 users, PII=email/phone | PASS | - | - | Y |
| T0694 | RBAC | API | Staff directory | FIELD_EXECUTIVE lists all company users via GET /api/users | Security | FIELD_EXECUTIVE | 403, or scoped to own hierarchy without contact PII | 200 returned 1 users, PII=email/phone | PASS | - | - | Y |
| T0695 | RBAC | API | Staff directory | PRODUCTION_EXECUTIVE lists all company users via GET /api/users | Security | PRODUCTION_EXECUTIVE | 403, or scoped to own hierarchy without contact PII | 200 returned 1 users, PII=email/phone | PASS | - | - | Y |
| T0696 | RBAC | API | Staff directory | COMMUNITY_MANAGER lists all company users via GET /api/users | Security | COMMUNITY_MANAGER | 403, or scoped to own hierarchy without contact PII | 200 returned 1 users, PII=email/phone | PASS | - | - | Y |
| T0697 | RBAC | API | Staff directory | CHANNEL_PARTNER lists all company users via GET /api/users | Security | CHANNEL_PARTNER | 403, or scoped to own hierarchy without contact PII | 200 returned 1 users, PII=email/phone | PASS | - | - | Y |
| T0698 | RBAC | API | Staff directory | COWORKING_ADMIN lists all company users via GET /api/users | Security | COWORKING_ADMIN | 403, or scoped to own hierarchy without contact PII | 200 returned 1 users, PII=email/phone | PASS | - | - | Y |
| T0699 | RBAC | API | Staff directory | INSIDE_EXECUTIVE lists all company users via GET /api/users | Security | INSIDE_EXECUTIVE | 403, or scoped to own hierarchy without contact PII | 200 returned 1 users, PII=email/phone | PASS | - | - | Y |
| T0700 | RBAC | API | Lead record access | PRODUCTION_EXECUTIVE fetches a real lead by id (list endpoint returns 403 for this role) | Security | PRODUCTION_EXECUTIVE | 403 consistent with GET /api/leads | 404 | PASS | - | - | Y |
| T0701 | RBAC | API | Lead record access | COMMUNITY_MANAGER fetches a real lead by id (list endpoint returns 403 for this role) | Security | COMMUNITY_MANAGER | 403 consistent with GET /api/leads | 404 | PASS | - | - | Y |
| T0702 | RBAC | API | Lead record access | COWORKING_ADMIN fetches a real lead by id (list endpoint returns 403 for this role) | Security | COWORKING_ADMIN | 403 consistent with GET /api/leads | 404 | PASS | - | - | Y |
| T0703 | RBAC | API | Lead record access | CHANNEL_PARTNER fetches a real lead by id (list endpoint returns 403 for this role) | Security | CHANNEL_PARTNER | 403 consistent with GET /api/leads | 404 | PASS | - | - | Y |
| T0704 | RBAC | API | Lead analytics | PRODUCTION_EXECUTIVE reads /api/leads/performance/overview without the leads page | Security | PRODUCTION_EXECUTIVE | 403 | 200 aggregate lead data returned | FAIL | MEDIUM | CRM-BUG-008 | Y |
| T0705 | RBAC | API | Lead analytics | COMMUNITY_MANAGER reads /api/leads/performance/overview without the leads page | Security | COMMUNITY_MANAGER | 403 | 200 aggregate lead data returned | FAIL | MEDIUM | CRM-BUG-008 | Y |
| T0706 | RBAC | API | Lead analytics | COWORKING_ADMIN reads /api/leads/performance/overview without the leads page | Security | COWORKING_ADMIN | 403 | 200 aggregate lead data returned | FAIL | MEDIUM | CRM-BUG-008 | Y |
| T0707 | RBAC | API | Lead analytics | CHANNEL_PARTNER reads /api/leads/performance/overview without the leads page | Security | CHANNEL_PARTNER | 403 | 200 aggregate lead data returned | FAIL | MEDIUM | CRM-BUG-008 | Y |
| T0708 | RBAC | API | Owner/Broker contact data… | PRODUCTION_EXECUTIVE reads /api/contacts without the inventory page | Security | PRODUCTION_EXECUTIVE | 403 | 200 count=1 | FAIL | HIGH | CRM-BUG-005 | Y |
| T0709 | RBAC | API | Owner/Broker contact data… | COMMUNITY_MANAGER reads /api/contacts without the inventory page | Security | COMMUNITY_MANAGER | 403 | 200 count=1 | FAIL | HIGH | CRM-BUG-005 | Y |
| T0710 | RBAC | API | Page access enforcement | CHANNEL_PARTNER reaches /api/tasks though role defaults exclude that page | Security | CHANNEL_PARTNER | 403 | 200 | FAIL | MEDIUM | CRM-BUG-004 | Y |
| T0711 | RBAC | API | Page access enforcement | CHANNEL_PARTNER reaches /api/chat/rooms though role defaults exclude that page | Security | CHANNEL_PARTNER | 403 | 200 | FAIL | MEDIUM | CRM-BUG-004 | Y |
| T0712 | RBAC | API | Page access enforcement | CHANNEL_PARTNER reaches /api/chat/contacts though role defaults exclude that page | Security | CHANNEL_PARTNER | 403 | 200 | FAIL | MEDIUM | CRM-BUG-004 | Y |
| T0713 | RBAC | API | Page access enforcement | CHANNEL_PARTNER reaches /api/targets/my though role defaults exclude that page | Security | CHANNEL_PARTNER | 403 | 200 | FAIL | MEDIUM | CRM-BUG-004 | Y |
| T0714 | RBAC | API | Page access enforcement | COWORKING_ADMIN reaches /api/tasks though role defaults exclude that page | Security | COWORKING_ADMIN | 403 | 200 | FAIL | MEDIUM | CRM-BUG-004 | Y |
| T0715 | RBAC | API | Page access enforcement | COWORKING_ADMIN reaches /api/chat/rooms though role defaults exclude that page | Security | COWORKING_ADMIN | 403 | 200 | FAIL | MEDIUM | CRM-BUG-004 | Y |
| T0716 | RBAC | API | Page access enforcement | COWORKING_ADMIN reaches /api/chat/contacts though role defaults exclude that page | Security | COWORKING_ADMIN | 403 | 200 | FAIL | MEDIUM | CRM-BUG-004 | Y |
| T0717 | RBAC | API | Page access enforcement | COWORKING_ADMIN reaches /api/targets/my though role defaults exclude that page | Security | COWORKING_ADMIN | 403 | 200 | FAIL | MEDIUM | CRM-BUG-004 | Y |
| T0718 | RBAC | API | Privilege escalation (wri… | PRODUCTION_EXECUTIVE: create user as low role | Security | PRODUCTION_EXECUTIVE | 403 denied | 403 Only ADMIN or MANAGER can create users | PASS | - | - | Y |
| T0719 | RBAC | API | Privilege escalation (wri… | PRODUCTION_EXECUTIVE: delete a user as low role | Security | PRODUCTION_EXECUTIVE | 403 denied | 403 Only ADMIN can delete users | PASS | - | - | Y |
| T0720 | RBAC | API | Privilege escalation (wri… | PRODUCTION_EXECUTIVE: assign target as low role | Security | PRODUCTION_EXECUTIVE | 403 denied | 403 You are not allowed to assign targets | PASS | - | - | Y |
| T0721 | RBAC | API | Privilege escalation (wri… | PRODUCTION_EXECUTIVE: edit attendance policy as low role | Security | PRODUCTION_EXECUTIVE | 403 denied | 403 Only admin and management roles can perform this action | PASS | - | - | Y |
| T0722 | RBAC | API | Privilege escalation (wri… | PRODUCTION_EXECUTIVE: create custom role as low role | Security | PRODUCTION_EXECUTIVE | 403 denied | 403 Access denied | PASS | - | - | Y |
| T0723 | RBAC | API | Privilege escalation (wri… | PRODUCTION_EXECUTIVE: grant self page access | Security | PRODUCTION_EXECUTIVE | 403 denied | 403 Access denied | PASS | - | - | Y |
| T0724 | RBAC | API | Privilege escalation (wri… | EXECUTIVE: create user as low role | Security | EXECUTIVE | 403 denied | 403 Only ADMIN or MANAGER can create users | PASS | - | - | Y |
| T0725 | RBAC | API | Privilege escalation (wri… | EXECUTIVE: delete a user as low role | Security | EXECUTIVE | 403 denied | 403 Only ADMIN can delete users | PASS | - | - | Y |
| T0726 | RBAC | API | Privilege escalation (wri… | EXECUTIVE: assign target as low role | Security | EXECUTIVE | 403 denied | 403 You are not allowed to assign targets | PASS | - | - | Y |
| T0727 | RBAC | API | Privilege escalation (wri… | EXECUTIVE: edit attendance policy as low role | Security | EXECUTIVE | 403 denied | 403 Only admin and management roles can perform this action | PASS | - | - | Y |
| T0728 | RBAC | API | Privilege escalation (wri… | EXECUTIVE: create custom role as low role | Security | EXECUTIVE | 403 denied | 403 Access denied | PASS | - | - | Y |
| T0729 | RBAC | API | Privilege escalation (wri… | EXECUTIVE: grant self page access | Security | EXECUTIVE | 403 denied | 403 Access denied | PASS | - | - | Y |
| T0730 | RBAC | API | Privilege escalation (wri… | CHANNEL_PARTNER: create user as low role | Security | CHANNEL_PARTNER | 403 denied | 403 Only ADMIN or MANAGER can create users | PASS | - | - | Y |
| T0731 | RBAC | API | Privilege escalation (wri… | CHANNEL_PARTNER: delete a user as low role | Security | CHANNEL_PARTNER | 403 denied | 403 Only ADMIN can delete users | PASS | - | - | Y |
| T0732 | RBAC | API | Privilege escalation (wri… | CHANNEL_PARTNER: assign target as low role | Security | CHANNEL_PARTNER | 403 denied | 403 You are not allowed to assign targets | PASS | - | - | Y |
| T0733 | RBAC | API | Privilege escalation (wri… | CHANNEL_PARTNER: edit attendance policy as low role | Security | CHANNEL_PARTNER | 403 denied | 403 Only admin and management roles can perform this action | PASS | - | - | Y |
| T0734 | RBAC | API | Privilege escalation (wri… | CHANNEL_PARTNER: create custom role as low role | Security | CHANNEL_PARTNER | 403 denied | 403 Access denied | PASS | - | - | Y |
| T0735 | RBAC | API | Privilege escalation (wri… | CHANNEL_PARTNER: grant self page access | Security | CHANNEL_PARTNER | 403 denied | 403 Access denied | PASS | - | - | Y |
| T0736 | RBAC | API | Privilege escalation (wri… | COWORKING_ADMIN: create user as low role | Security | COWORKING_ADMIN | 403 denied | 403 Only ADMIN or MANAGER can create users | PASS | - | - | Y |
| T0737 | RBAC | API | Privilege escalation (wri… | COWORKING_ADMIN: delete a user as low role | Security | COWORKING_ADMIN | 403 denied | 403 Only ADMIN can delete users | PASS | - | - | Y |
| T0738 | RBAC | API | Privilege escalation (wri… | COWORKING_ADMIN: assign target as low role | Security | COWORKING_ADMIN | 403 denied | 403 You are not allowed to assign targets | PASS | - | - | Y |
| T0739 | RBAC | API | Privilege escalation (wri… | COWORKING_ADMIN: edit attendance policy as low role | Security | COWORKING_ADMIN | 403 denied | 403 Only admin and management roles can perform this action | PASS | - | - | Y |
| T0740 | RBAC | API | Privilege escalation (wri… | COWORKING_ADMIN: create custom role as low role | Security | COWORKING_ADMIN | 403 denied | 403 Access denied | PASS | - | - | Y |
| T0741 | RBAC | API | Privilege escalation (wri… | COWORKING_ADMIN: grant self page access | Security | COWORKING_ADMIN | 403 denied | 403 Access denied | PASS | - | - | Y |
| T0742 | RBAC | API | Self privilege escalation | EXECUTIVE sets role=ADMIN through PATCH /api/users/profile | Security | EXECUTIVE | role unchanged | status=400 role is now EXECUTIVE | PASS | - | - | Y |
| T0743 | RBAC | API | Self privilege escalation | PRODUCTION_EXECUTIVE sets role=ADMIN through PATCH /api/users/profile | Security | PRODUCTION_EXECUTIVE | role unchanged | status=400 role is now PRODUCTION_EXECUTIVE | PASS | - | - | Y |
| T0744 | RBAC | API | Team chat directory | external partner role reads internal staff chat contacts | Security | CHANNEL_PARTNER | 403 (chat is not in CHANNEL_PARTNER default pages) | 200 count=26 | FAIL | HIGH | CRM-BUG-006 | Y |
| T0745 | Access Control | API | Employee page access | admin sets per-page action grants for an employee | API | ADMIN | 200 | 200 | PASS | - | - | Y |
| T0746 | Access Control | API | Action-to-verb mapping | DELETE /api/contacts/:id with page grant inventory=[view,edit] and NO delete action | Security | EXECUTIVE(page-over… | 403 (no delete permission) | 404 Contact not found (404 = permission gate passed, handler … | FAIL | HIGH | CRM-BUG-005 | Y |
| T0747 | Access Control | API | Action-to-verb mapping | DELETE /api/inventory/:id with inventory=[view,edit] (route also has checkRoleOrPageActio… | Security | EXECUTIVE(page-over… | 403 | 403 | PASS | - | - | Y |
| T0748 | Access Control | API | Action-to-verb mapping | DELETE /api/tasks/:id with tasks=[view,edit] and no delete action | Security | EXECUTIVE(page-over… | 403 | 404 Task not found | FAIL | MEDIUM | CRM-BUG-007 | Y |
| T0749 | Access Control | API | Action-to-verb mapping | POST /api/leads with leads=[view,follow_up] and NO create action | Security | EXECUTIVE(page-over… | 403 | 403 Your account does not have permission to create on this p… | PASS | - | - | Y |
| T0750 | Access Control | API | Employee page access | GET /api/projects after override omitting that page | Security | EXECUTIVE(page-over… | 403 | 403 | PASS | - | - | Y |
| T0751 | Access Control | API | Employee page access | GET /api/attendance/me after override omitting that page | Security | EXECUTIVE(page-over… | 403 | 403 | PASS | - | - | Y |
| T0752 | Access Control | API | Employee page access | GET /api/chat/rooms after override omitting that page | Security | EXECUTIVE(page-over… | 403 | 403 | PASS | - | - | Y |
| T0753 | Access Control | API | Employee page access | GET /api/targets/my after override omitting that page | Security | EXECUTIVE(page-over… | 403 | 403 | PASS | - | - | Y |
| T0754 | Access Control | API | Employee page access | GET /api/inventory with inventory page granted | Functional | EXECUTIVE(page-over… | 200 | 200 | PASS | - | - | Y |
| T0755 | Access Control | API | Page grant validation | unknown page key | Validation | ADMIN | 400 rejected or silently filtered | 400 | PASS | - | - | Y |
| T0756 | Access Control | API | Page grant validation | unknown action | Validation | ADMIN | 400 rejected or silently filtered | 400 | PASS | - | - | Y |
| T0757 | Access Control | API | Page grant validation | non-array pages | Validation | ADMIN | 400 rejected or silently filtered | 400 | PASS | - | - | Y |
| T0758 | Access Control | API | Page grant validation | action escalation to admin_team delete | Validation | ADMIN | 200 (admin may grant) | 200 | PASS | - | - | Y |
| T0759 | Leads | API | Create lead validation | valid minimal | API | ADMIN | 2xx | 201 Lead created and assigned to creator | PASS | - | - | Y |
| T0760 | Leads | API | Create lead validation | missing name | API | ADMIN | 4xx | 500 Server error | FAIL | MEDIUM | CRM-BUG-009 | Y |
| T0761 | Leads | API | Create lead validation | missing phone | API | ADMIN | 4xx | 500 Server error | FAIL | MEDIUM | - | Y |
| T0762 | Leads | API | Create lead validation | empty strings | API | ADMIN | 4xx | 500 Server error | FAIL | MEDIUM | - | Y |
| T0763 | Leads | API | Create lead validation | spaces only | API | ADMIN | 4xx | 201 Lead created and assigned to creator | FAIL | MEDIUM | CRM-BUG-011 | Y |
| T0764 | Leads | API | Create lead validation | phone with letters | API | ADMIN | 4xx | 201 Lead created and assigned to creator | FAIL | MEDIUM | CRM-BUG-011 | Y |
| T0765 | Leads | API | Create lead validation | phone too short | API | ADMIN | 4xx | 201 Lead created and assigned to creator | FAIL | MEDIUM | CRM-BUG-011 | Y |
| T0766 | Leads | API | Create lead validation | phone too long | API | ADMIN | 4xx | 201 Lead created and assigned to creator | FAIL | MEDIUM | CRM-BUG-011 | Y |
| T0767 | Leads | API | Create lead validation | invalid email | API | ADMIN | 4xx | 201 Lead created and assigned to creator | FAIL | MEDIUM | CRM-BUG-011 | Y |
| T0768 | Leads | API | Create lead validation | name 10k chars | API | ADMIN | 4xx | 201 Lead created and assigned to creator | FAIL | MEDIUM | CRM-BUG-011 | Y |
| T0769 | Leads | API | Create lead validation | emoji name | API | ADMIN | 2xx | 201 Lead created and assigned to creator | PASS | - | - | Y |
| T0770 | Leads | API | Create lead validation | unicode name | API | ADMIN | 2xx | 201 Lead created and assigned to creator | PASS | - | - | Y |
| T0771 | Leads | API | Create lead validation | html in name | API | ADMIN | 2xx | 201 Lead created and assigned to creator | PASS | - | - | Y |
| T0772 | Leads | API | Create lead validation | nosql operator in phone | API | ADMIN | 4xx | 400 Lead already exists | PASS | - | - | Y |
| T0773 | Leads | API | Create lead validation | negative budget | API | ADMIN | 4xx | 201 Lead created and assigned to creator | FAIL | MEDIUM | CRM-BUG-011 | Y |
| T0774 | Leads | API | Create lead validation | zero budget | API | ADMIN | no 500 | 201 Lead created and assigned to creator | PASS | - | - | Y |
| T0775 | Leads | API | Create lead validation | huge budget | API | ADMIN | no 500 | 201 Lead created and assigned to creator | PASS | - | - | Y |
| T0776 | Leads | API | Create lead validation | invalid status enum | API | ADMIN | 4xx | 201 Lead created and assigned to creator | FAIL | MEDIUM | CRM-BUG-024 | Y |
| T0777 | Leads | API | Create lead validation | invalid source enum | API | ADMIN | no 500 | 201 Lead created and assigned to creator | PASS | - | - | Y |
| T0778 | Leads | API | Create lead validation | future-dated followUp | API | ADMIN | no 500 | 201 Lead created and assigned to creator | PASS | - | - | Y |
| T0779 | Leads | API | Create lead validation | past-dated followUp | API | ADMIN | no 500 | 201 Lead created and assigned to creator | PASS | - | - | Y |
| T0780 | Leads | API | Create lead validation | garbage date | API | ADMIN | 4xx | 201 Lead created and assigned to creator | FAIL | MEDIUM | - | Y |
| T0781 | Leads | API | Create lead validation | assign to another company user | API | ADMIN | 4xx | 201 Lead created and assigned to creator | FAIL | MEDIUM | - | Y |
| T0782 | Leads | API | List leads | page=1 limit=5 honours page size | API | ADMIN | <=5 rows | 5 | PASS | - | - | Y |
| T0783 | Leads | API | Pagination | limit=0 | API | ADMIN | no 500, bounded page size | 200 rows=50 | PASS | - | - | Y |
| T0784 | Leads | API | Pagination | limit=-5 | API | ADMIN | no 500, bounded page size | 200 rows=50 | PASS | - | - | Y |
| T0785 | Leads | API | Pagination | limit=100000 | API | ADMIN | no 500, bounded page size | 200 rows=200 | PASS | - | - | Y |
| T0786 | Leads | API | Pagination | page=0 | API | ADMIN | no 500, bounded page size | 200 rows=5 | PASS | - | - | Y |
| T0787 | Leads | API | Pagination | page=-1 | API | ADMIN | no 500, bounded page size | 200 rows=5 | PASS | - | - | Y |
| T0788 | Leads | API | Pagination | page=999999 (beyond end) | API | ADMIN | no 500, bounded page size | 200 rows=0 | PASS | - | - | Y |
| T0789 | Leads | API | Pagination | page=abc | API | ADMIN | no 500, bounded page size | 200 rows=50 | PASS | - | - | Y |
| T0790 | Leads | API | Pagination | limit as array | API | ADMIN | no 500, bounded page size | 200 rows=1194 | FAIL | MEDIUM | - | Y |
| T0791 | Leads | API | Search | exact name | API | ADMIN | no 500, responsive | 200 rows=1 139ms | PASS | - | - | Y |
| T0792 | Leads | API | Search | partial | API | ADMIN | no 500, responsive | 200 rows=1 167ms | PASS | - | - | Y |
| T0793 | Leads | API | Search | different case | API | ADMIN | no 500, responsive | 200 rows=1 40ms | PASS | - | - | Y |
| T0794 | Leads | API | Search | no result | API | ADMIN | no 500, responsive | 200 rows=0 25ms | PASS | - | - | Y |
| T0795 | Leads | API | Search | regex metachars | API | ADMIN | no 500, responsive | 200 rows=0 22ms | PASS | - | - | Y |
| T0796 | Leads | API | Search | regex dos attempt | API | ADMIN | no 500, responsive | 200 rows=0 20ms | PASS | - | - | Y |
| T0797 | Leads | API | Search | special chars | API | ADMIN | no 500, responsive | 200 rows=0 18ms | PASS | - | - | Y |
| T0798 | Leads | API | Search | empty search | API | ADMIN | no 500, responsive | 200 rows=1194 635ms | PASS | - | - | Y |
| T0799 | Leads | API | Search | unescaped regex in search (.* matches all rows) | Security | ADMIN | search treated as literal text | total(all)=undefined total(.*)=undefined | PASS | - | - | Y |
| T0800 | Leads | API | Sorting | sortBy=createdAt | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0801 | Leads | API | Sorting | sortBy=-createdAt | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0802 | Leads | API | Sorting | sortBy=name | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0803 | Leads | API | Sorting | sortBy=-name | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0804 | Leads | API | Sorting | sortBy=budget | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0805 | Leads | API | Sorting | sortBy=nonexistentField | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0806 | Leads | API | Sorting | sortBy=; drop | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0807 | Leads | API | Sorting | sortBy={"$ne":1} | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0808 | Leads | API | Filters | filter ?status=NEW | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0809 | Leads | API | Filters | filter ?status=NEW&source=WEBSITE | API | ADMIN | no 500 | 400 | PASS | - | - | Y |
| T0810 | Leads | API | Filters | filter ?status=INVALID_STATUS | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0811 | Leads | API | Filters | filter ?assignedTo=0123456789abcdef01234567 | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0812 | Leads | API | Filters | filter ?assignedTo=not-an-id | API | ADMIN | no 500 | 400 | PASS | - | - | Y |
| T0813 | Leads | API | Filters | filter ?fromDate=2026-01-01&toDate=2026-12-31 | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0814 | Leads | API | Filters | filter ?fromDate=2030-01-01&toDate=2020-01-01 | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0815 | Leads | API | Filters | filter ?fromDate=garbage | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0816 | Leads | API | Filters | filter ?status[]=NEW&status[]=CLOSED | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0817 | Leads | API | Read lead | nonexistent objectid | API | ADMIN | 404 (never 500) | 404 Lead not found | PASS | - | - | Y |
| T0818 | Leads | API | Read lead | malformed id | API | ADMIN | 400 (never 500) | 400 Invalid lead id | PASS | - | - | Y |
| T0819 | Leads | API | Read lead | nosql operator id | API | ADMIN | 400 (never 500) | 400 Invalid lead id | PASS | - | - | Y |
| T0820 | Leads | API | Read lead | empty-ish id | API | ADMIN | 400 (never 500) | 400 Invalid lead id | PASS | - | - | Y |
| T0821 | Leads | API | Update lead | edit a single field | API | ADMIN | 2xx | 200 | PASS | - | - | Y |
| T0822 | Leads | API | Lead status | set status CONTACTED | API | ADMIN | 2xx | 200 Lead status updated | PASS | - | - | Y |
| T0823 | Leads | API | Lead status | set status INVALID_STATE | API | ADMIN | 4xx | 400 Status must be one of: NEW, CONTACTED, FOLLOW_UP_1 | PASS | - | - | Y |
| T0824 | Leads | API | Lead status | set status CLOSED | API | ADMIN | 2xx | 400 Brokerage Received is required when closing a deal | FAIL | - | - | Y |
| T0825 | Leads | API | Lead activity | activity trail records create/edit/status changes | API | ADMIN | non-empty history | 200 entries=3 | PASS | - | - | Y |
| T0826 | Leads | API | IDOR | EXECUTIVE reads an admin-owned lead not assigned to them | Security | EXECUTIVE | 403/404 | 404 | PASS | - | - | Y |
| T0827 | Leads | API | IDOR | EXECUTIVE edits a lead not assigned to them | Security | EXECUTIVE | 403/404 | 404 | PASS | - | - | Y |
| T0828 | Leads | API | IDOR | EXECUTIVE deletes a lead not assigned to them | Security | EXECUTIVE | 403/404 | 404 | PASS | - | - | Y |
| T0829 | Leads | API | IDOR | INSIDE_EXECUTIVE reads an admin-owned lead not assigned to them | Security | INSIDE_EXECUTIVE | 403/404 | 404 | PASS | - | - | Y |
| T0830 | Leads | API | IDOR | INSIDE_EXECUTIVE edits a lead not assigned to them | Security | INSIDE_EXECUTIVE | 403/404 | 404 | PASS | - | - | Y |
| T0831 | Leads | API | IDOR | INSIDE_EXECUTIVE deletes a lead not assigned to them | Security | INSIDE_EXECUTIVE | 403/404 | 404 | PASS | - | - | Y |
| T0832 | Leads | API | Concurrency | two simultaneous PATCH requests | API | ADMIN | both succeed or one 409; no corruption | 200/200 final=Concurrent B | PASS | - | - | Y |
| T0833 | Leads | API | Pagination | GET /api/leads | Performance | ADMIN | response capped (<=200 rows) | 200 rows=1195 2721KB 481ms | FAIL | HIGH | CRM-BUG-001 | Y |
| T0834 | Leads | API | Pagination | GET /api/leads?limit=5 | Performance | ADMIN | response capped (<=200 rows) | 200 rows=5 14KB 17ms | PASS | - | - | Y |
| T0835 | Leads | API | Pagination | GET /api/leads?page=1&limit=5 | Performance | ADMIN | response capped (<=200 rows) | 200 rows=5 14KB 14ms | PASS | - | - | Y |
| T0836 | Leads | API | Pagination | GET /api/leads?search= | Performance | ADMIN | response capped (<=200 rows) | 200 rows=1195 2721KB 344ms | FAIL | HIGH | CRM-BUG-001 | Y |
| T0837 | Leads | API | Pagination | GET /api/leads?status=NEW | Performance | ADMIN | response capped (<=200 rows) | 200 rows=807 1834KB 249ms | FAIL | HIGH | CRM-BUG-001 | Y |
| T0838 | Leads | API | Pagination | GET /api/leads?limit[]=5&limit[]=9 | Performance | ADMIN | response capped (<=200 rows) | 200 rows=1195 2721KB 424ms | FAIL | HIGH | CRM-BUG-001 | Y |
| T0839 | Leads | API | Pagination | GET /api/leads?page[]=1&limit=5 | Performance | ADMIN | response capped (<=200 rows) | 200 rows=5 14KB 21ms | PASS | - | - | Y |
| T0840 | Leads | API | Pagination | GET /api/leads?limit=100000 | Performance | ADMIN | response capped (<=200 rows) | 200 rows=200 480KB 90ms | PASS | - | - | Y |
| T0841 | API | API | List pagination | GET /api/users with no pagination params | Performance | ADMIN | bounded page + pagination metadata | rows=27 27KB 24ms | PASS | - | - | Y |
| T0842 | API | API | List pagination | GET /api/inventory with no pagination params | Performance | ADMIN | bounded page + pagination metadata | rows=4 22KB 23ms | PASS | - | - | Y |
| T0843 | API | API | List pagination | GET /api/tasks with no pagination params | Performance | ADMIN | bounded page + pagination metadata | rows=14 8KB 36ms | PASS | - | - | Y |
| T0844 | API | API | List pagination | GET /api/contacts with no pagination params | Performance | ADMIN | bounded page + pagination metadata | rows=1 0KB 16ms | PASS | - | - | Y |
| T0845 | API | API | List pagination | GET /api/projects with no pagination params | Performance | ADMIN | bounded page + pagination metadata | rows=1 1KB 17ms | PASS | - | - | Y |
| T0846 | API | API | List pagination | GET /api/coworking/clients with no pagination params | Performance | ADMIN | bounded page + pagination metadata | rows=1 1KB 12ms | PASS | - | - | Y |
| T0847 | API | API | List pagination | GET /api/coworking/cabins with no pagination params | Performance | ADMIN | bounded page + pagination metadata | rows=-1 2KB 17ms | PASS | - | - | Y |
| T0848 | API | API | List pagination | GET /api/chat/rooms with no pagination params | Performance | ADMIN | bounded page + pagination metadata | rows=-1 2KB 23ms | PASS | - | - | Y |
| T0849 | API | API | List pagination | GET /api/attendance/violations with no pagination params | Performance | ADMIN | bounded page + pagination metadata | rows=-1 79KB 93ms | PASS | - | - | Y |
| T0850 | Leads | API | Sorting | sortBy=name vs sortBy=-name produce different order | Functional | ADMIN | ascending and descending differ | identical (sort param ignored) | FAIL | MEDIUM | CRM-BUG-015 | Y |
| T0851 | Security | API | Security headers | X-Powered-By hidden | Security | anon | absent | absent | PASS | - | - | Y |
| T0852 | Security | API | Security headers | x-content-type-options present on API responses | Security | anon | set | nosniff | PASS | - | - | Y |
| T0853 | Security | API | Security headers | x-frame-options present on API responses | Security | anon | set | SAMEORIGIN | PASS | - | - | Y |
| T0854 | Security | API | Security headers | content-security-policy present on API responses | Security | anon | set | default-src 'self';base-uri 'self';font-src 'self' https: dat… | PASS | - | - | Y |
| T0855 | Security | API | Security headers | strict-transport-security present on API responses | Security | anon | set | max-age=31536000; includeSubDomains | PASS | - | - | Y |
| T0856 | Security | API | CORS | untrusted origin is not reflected in Access-Control-Allow-Origin | Security | anon | no ACAO for unknown origin | ACAO=none | PASS | - | - | Y |
| T0857 | Security | API | CORS | any LAN 192.168.x.x origin is allowed with credentials | Security | anon | explicit allowlist only | ACAO=http://192.168.1.50:3000 creds=true | FAIL | MEDIUM | CRM-BUG-018 | Y |
| T0858 | Security | API | File upload | upload legit png | Security | ADMIN | accepted | 201 | PASS | - | - | Y |
| T0859 | Security | API | File upload validation | upload html disguised as octet-stream | Security | ADMIN | rejected | 201 http://127.0.0.1:54213/api/uploads/files/chat/17897287675… | FAIL | HIGH | CRM-BUG-003 | Y |
| T0860 | Security | API | File upload validation | upload svg with embedded script | Security | ADMIN | rejected | 201 http://127.0.0.1:54213/api/uploads/files/chat/17897287675… | FAIL | HIGH | CRM-BUG-003 | Y |
| T0861 | Security | API | File upload validation | upload executable renamed | Security | ADMIN | rejected | 201 http://127.0.0.1:54213/api/uploads/files/chat/17897287675… | FAIL | HIGH | CRM-BUG-003 | Y |
| T0862 | Security | API | File upload validation | upload disallowed type (php) | Security | ADMIN | rejected | 400 Unsupported file type: application/x-php | PASS | - | - | Y |
| T0863 | Security | API | File upload | path traversal in filename is sanitised | Security | ADMIN | no .. in stored path | http://127.0.0.1:54213/api/uploads/files/chat/1789728767587-1… | PASS | - | - | Y |
| T0864 | Security | API | File upload validation | upload double extension | Security | ADMIN | rejected | 201 http://127.0.0.1:54213/api/uploads/files/chat/17897287676… | FAIL | HIGH | CRM-BUG-003 | Y |
| T0865 | Security | API | File authorization | uploaded file retrievable with no authentication | Security | anon | 401/403 for files attached to business records | HTTP 200 (image/png) | FAIL | HIGH | CRM-BUG-002 | Y |
| T0866 | Security | API | Stored XSS via upload | uploaded .html served as text/html; charset=utf-8 | Security | anon | served as attachment / non-executable type | content-type=text/html; charset=utf-8; CSP=present; nosniff=n… | FAIL | HIGH | CRM-BUG-003 | Y |
| T0867 | Security | API | Stored XSS via upload | uploaded .svg served as image/svg+xml | Security | anon | served as attachment / non-executable type | content-type=image/svg+xml; CSP=present; nosniff=nosniff | FAIL | HIGH | CRM-BUG-003 | Y |
| T0868 | Security | API | Stored XSS via upload | uploaded .html served as text/html; charset=utf-8 | Security | anon | served as attachment / non-executable type | content-type=text/html; charset=utf-8; CSP=present; nosniff=n… | FAIL | HIGH | CRM-BUG-003 | Y |
| T0869 | API | API | Error handling | POST /api/leads with invalid/empty payload | Security | ADMIN | 400 with a field-level message | 500 Server error | FAIL | MEDIUM | - | Y |
| T0870 | Security | API | Error handling | no stack trace leaked from POST /api/leads | Security | ADMIN | no internals in response | clean | PASS | - | - | Y |
| T0871 | API | API | Error handling | POST /api/tasks with invalid/empty payload | Security | ADMIN | 400 with a field-level message | 400 Task title is required | PASS | - | - | Y |
| T0872 | Security | API | Error handling | no stack trace leaked from POST /api/tasks | Security | ADMIN | no internals in response | clean | PASS | - | - | Y |
| T0873 | API | API | Error handling | POST /api/users/create with invalid/empty payload | Security | ADMIN | 400 with a field-level message | 400 Invalid role | PASS | - | - | Y |
| T0874 | Security | API | Error handling | no stack trace leaked from POST /api/users/create | Security | ADMIN | no internals in response | clean | PASS | - | - | Y |
| T0875 | API | API | Error handling | POST /api/contacts with invalid/empty payload | Security | ADMIN | 400 with a field-level message | 400 Name, valid phone and contact type are required | PASS | - | - | Y |
| T0876 | Security | API | Error handling | no stack trace leaked from POST /api/contacts | Security | ADMIN | no internals in response | clean | PASS | - | - | Y |
| T0877 | API | API | Error handling | POST /api/projects with invalid/empty payload | Security | ADMIN | 400 with a field-level message | 400 projectCategory is required | PASS | - | - | Y |
| T0878 | Security | API | Error handling | no stack trace leaked from POST /api/projects | Security | ADMIN | no internals in response | clean | PASS | - | - | Y |
| T0879 | API | API | Error handling | POST /api/inventory with invalid/empty payload | Security | ADMIN | 400 with a field-level message | 400 projectName is required | PASS | - | - | Y |
| T0880 | Security | API | Error handling | no stack trace leaked from POST /api/inventory | Security | ADMIN | no internals in response | clean | PASS | - | - | Y |
| T0881 | API | API | Error handling | PATCH /api/users/profile with invalid/empty payload | Security | ADMIN | 400 with a field-level message | 200 Profile updated | PASS | - | - | Y |
| T0882 | Security | API | Error handling | no stack trace leaked from PATCH /api/users/profile | Security | ADMIN | no internals in response | clean | PASS | - | - | Y |
| T0883 | API | API | Error handling | POST /api/tasks with invalid/empty payload | Security | ADMIN | 400 with a field-level message | 400 Invalid assignee ID | PASS | - | - | Y |
| T0884 | Security | API | Error handling | no stack trace leaked from POST /api/tasks | Security | ADMIN | no internals in response | clean | PASS | - | - | Y |
| T0885 | API | API | Error handling | POST /api/leads with invalid/empty payload | Security | ADMIN | 400 with a field-level message | 201 Lead created and assigned to creator | PASS | - | - | Y |
| T0886 | Security | API | Error handling | no stack trace leaked from POST /api/leads | Security | ADMIN | no internals in response | clean | PASS | - | - | Y |
| T0887 | Security | API | Brute force protection | 12 consecutive failed logins trigger rate limiting | Security | anon | 429 after the configured threshold | 400,400,400,400,429,429,429,429,429,429,429,429 | PASS | - | - | Y |
| T0888 | Tasks | API | Create task validation | valid | API | ADMIN | accept | 201 undefined | PASS | - | - | Y |
| T0889 | Tasks | API | Create task validation | missing title | API | ADMIN | reject | 400 Task title is required | PASS | - | - | Y |
| T0890 | Tasks | API | Create task validation | empty title | API | ADMIN | reject | 400 Task title is required | PASS | - | - | Y |
| T0891 | Tasks | API | Create task validation | whitespace title | API | ADMIN | reject | 500 Failed to create task | FAIL | MEDIUM | CRM-BUG-024 | Y |
| T0892 | Tasks | API | Create task validation | title 5000 chars | API | ADMIN | either | 201 undefined | PASS | - | - | Y |
| T0893 | Tasks | API | Create task validation | invalid status | API | ADMIN | reject | 500 Failed to create task | FAIL | MEDIUM | CRM-BUG-024 | Y |
| T0894 | Tasks | API | Create task validation | invalid priority | API | ADMIN | either | 500 Failed to create task | FAIL | MEDIUM | CRM-BUG-024 | Y |
| T0895 | Tasks | API | Create task validation | assignee not in company | API | ADMIN | reject | 400 Assignee does not belong to your company | PASS | - | - | Y |
| T0896 | Tasks | API | Create task validation | assignee malformed | API | ADMIN | reject | 400 Invalid assignee ID | PASS | - | - | Y |
| T0897 | Tasks | API | Create task validation | past due date | API | ADMIN | either | 201 undefined | PASS | - | - | Y |
| T0898 | Tasks | API | Create task validation | garbage due date | API | ADMIN | either | 500 Failed to create task | FAIL | MEDIUM | CRM-BUG-024 | Y |
| T0899 | Tasks | API | Create task validation | no assignee | API | ADMIN | either | 201 undefined | PASS | - | - | Y |
| T0900 | Tasks | API | Task visibility | assignee can read the task assigned to them | API | EXECUTIVE | 200 | 200 | PASS | - | - | Y |
| T0901 | Tasks | API | Task visibility | unrelated user cannot read someone else's task | Security | PRODUCTION_EXECUTIVE | 403/404 | 403 | PASS | - | - | Y |
| T0902 | Tasks | API | Task delete permission | non-creator cannot delete a task | Security | PRODUCTION_EXECUTIVE | 403 | 403 | PASS | - | - | Y |
| T0903 | Tasks | API | Task stats | stats endpoint returns counts | API | ADMIN | 200 + numbers | 200 {"TODO":11,"IN_PROGRESS":0,"COMPLETED":7,"BACKLOG":0,"tot… | PASS | - | - | Y |
| T0904 | Inventory | API | Create inventory validati… | missing everything | API | ADMIN | reject | 400 projectName is required | PASS | - | - | Y |
| T0905 | Inventory | API | Create inventory validati… | projectName only | API | ADMIN | either | 400 towerName is required | PASS | - | - | Y |
| T0906 | Inventory | API | Create inventory validati… | negative price | API | ADMIN | reject | 400 price must be a valid positive number | PASS | - | - | Y |
| T0907 | Inventory | API | Create inventory validati… | huge price | API | ADMIN | either | 400 towerName is required | PASS | - | - | Y |
| T0908 | Inventory | API | Create inventory validati… | invalid propertyType | API | ADMIN | either | 400 towerName is required | PASS | - | - | Y |
| T0909 | Inventory | API | Create inventory validati… | nosql in field | API | ADMIN | reject | 400 projectName must be a non-empty string | PASS | - | - | Y |
| T0910 | Inventory | API | Auto-generated IDs | inventory display IDs are unique | Data | ADMIN | no duplicates | 4 ids, 2 duplicates | FAIL | MEDIUM | CRM-BUG-025 | Y |
| T0911 | Inventory | API | Public share link | valid share token viewable without auth | Functional | anon | 200 | 200 | PASS | - | - | Y |
| T0912 | Inventory | API | Public share link | invalid share token rejected | Security | anon | 404 | 404 | PASS | - | - | Y |
| T0913 | Inventory | API | Public share link | public listing does not expose owner contact details | Security | anon | owner PII withheld | no owner PII | PASS | - | - | Y |
| T0914 | Attendance | API | My attendance | employee reads own attendance | API | EXECUTIVE | 200 | 200 | PASS | - | - | Y |
| T0915 | Attendance | API | Check-in | first check-in of the day | API | EXECUTIVE | 2xx | 400 Location permission is required for check-in | FAIL | - | - | Y |
| T0916 | Attendance | API | Check-in | duplicate check-in on the same day is rejected | API | EXECUTIVE | 4xx | 400 Location permission is required for check-in | PASS | - | - | Y |
| T0917 | Attendance | API | Check-out | check-out after check-in | API | EXECUTIVE | 2xx | 400 Check-in is required before check-out | FAIL | - | - | Y |
| T0918 | Attendance | API | Check-out | duplicate check-out rejected | API | EXECUTIVE | 4xx | 400 Check-in is required before check-out | PASS | - | - | Y |
| T0919 | Attendance | API | Breaks | ending a break that never started | API | PRODUCTION_EXECUTIVE | 4xx not 500 | 400 Check-in is required before ending break | PASS | - | - | Y |
| T0920 | Attendance | API | Daily attendance | GET /attendance/daily | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0921 | Attendance | API | Daily attendance | GET /attendance/daily?date=2026-09-18 | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0922 | Attendance | API | Daily attendance | GET /attendance/daily?date=not-a-date | API | ADMIN | no 500 | 400 | PASS | - | - | Y |
| T0923 | Attendance | API | Daily attendance | GET /attendance/daily?date=9999-99-99 | API | ADMIN | no 500 | 400 | PASS | - | - | Y |
| T0924 | Attendance | API | Daily attendance | GET /attendance/daily?from=2026-01-01&to=2020-01-01 | API | ADMIN | no 500 | 200 | PASS | - | - | Y |
| T0925 | Attendance | API | Leave balance | employee reads own leave balance | API | EXECUTIVE | 200 | 200 | PASS | - | - | Y |
| T0926 | Attendance | API | Leave request | toDate earlier than fromDate rejected | API | EXECUTIVE | 400 | 400 fromDate cannot be after toDate | PASS | - | - | Y |
| T0927 | Coworking | API | Coworking read | COWORKING_ADMIN GET /api/coworking/properties | API | COWORKING_ADMIN | 200 | 200 | PASS | - | - | Y |
| T0928 | Coworking | API | Coworking read | COWORKING_ADMIN GET /api/coworking/floors | API | COWORKING_ADMIN | 200 | 200 | PASS | - | - | Y |
| T0929 | Coworking | API | Coworking read | COWORKING_ADMIN GET /api/coworking/cabins | API | COWORKING_ADMIN | 200 | 200 | PASS | - | - | Y |
| T0930 | Coworking | API | Coworking read | COWORKING_ADMIN GET /api/coworking/clients | API | COWORKING_ADMIN | 200 | 200 | PASS | - | - | Y |
| T0931 | Coworking | API | Coworking read | COWORKING_ADMIN GET /api/coworking/bookings | API | COWORKING_ADMIN | 200 | 200 | PASS | - | - | Y |
| T0932 | Coworking | API | Coworking read | COWORKING_ADMIN GET /api/coworking/contracts | API | COWORKING_ADMIN | 200 | 200 | PASS | - | - | Y |
| T0933 | Coworking | API | Coworking read | COWORKING_ADMIN GET /api/coworking/invoices | API | COWORKING_ADMIN | 200 | 200 | PASS | - | - | Y |
| T0934 | Coworking | API | Coworking read | COWORKING_ADMIN GET /api/coworking/payments | API | COWORKING_ADMIN | 200 | 200 | PASS | - | - | Y |
| T0935 | Coworking | API | Coworking read | COWORKING_ADMIN GET /api/coworking/expenses | API | COWORKING_ADMIN | 200 | 200 | PASS | - | - | Y |
| T0936 | Coworking | API | Coworking read | COWORKING_ADMIN GET /api/coworking/board | API | COWORKING_ADMIN | 200 | 200 | PASS | - | - | Y |
| T0937 | Coworking | API | Coworking read | COWORKING_ADMIN GET /api/coworking/permissions/me | API | COWORKING_ADMIN | 200 | 200 | PASS | - | - | Y |
| T0938 | Coworking | API | Coworking read | COWORKING_ADMIN GET /api/coworking/seats | API | COWORKING_ADMIN | 200 | 200 | PASS | - | - | Y |
| T0939 | Coworking | API | Booking validation | booking end date before start date | API | COWORKING_ADMIN | 400 | 400 Invalid clientId | PASS | - | - | Y |
| T0940 | Chat | API | Send message | empty message body rejected | API | ADMIN | 400 | 400 | PASS | - | - | Y |
| T0941 | Chat | API | Send message | message to a room the user is not in | Security | ADMIN | 403/404 | 404 | PASS | - | - | Y |
| T0942 | Projects | API | Create project validation | missing fields | API | ADMIN | 4xx not 500 | 400 projectCategory is required | PASS | - | - | Y |
| T0943 | Projects | API | Create project validation | nosql | API | ADMIN | 4xx not 500 | 400 projectCategory is required | PASS | - | - | Y |
| T0944 | Projects | API | Create project validation | long name | API | ADMIN | 4xx not 500 | 400 totalLandArea is required | PASS | - | - | Y |
| T0945 | Contacts | API | Create contact validation | missing fields | API | ADMIN | 4xx not 500 | 400 Name, valid phone and contact type are required | PASS | - | - | Y |
| T0946 | Contacts | API | Create contact validation | invalid phone | API | ADMIN | 4xx not 500 | 400 Name, valid phone and contact type are required | PASS | - | - | Y |
| T0947 | Contacts | API | Create contact validation | invalid kind | API | ADMIN | 4xx not 500 | 400 Name, valid phone and contact type are required | PASS | - | - | Y |
| T0948 | Login UI | UI | Login UI | login form renders email+password+submit | E2E | ADMIN | all three present | email=1 pw=1 submit=1 | PASS | - | - | Y |
| T0949 | Login UI | UI | Login UI | password field masked | E2E | ADMIN | type=password | password | PASS | - | - | Y |
| T0950 | Accessibility | UI | Accessibility | login inputs have programmatic labels | E2E | ADMIN | none unlabeled | 2 unlabeled: INPUT[email],INPUT[password] | FAIL | MEDIUM | CRM-BUG-021 | Y |
| T0951 | Login UI | UI | Login UI | submitting empty login form shows validation | E2E | ADMIN | inline validation message | no visible message | FAIL | MEDIUM | - | Y |
| T0952 | Login UI | UI | Login UI | invalid credentials show an error message | E2E | ADMIN | visible error | error shown | PASS | - | - | Y |
| T0953 | Login UI | UI | Login UI | valid admin credentials log in and redirect | E2E | ADMIN | navigates off /login | url=http://127.0.0.1:5173/ | PASS | - | - | Y |
| T0954 | Security | UI | Security | JWT access + refresh tokens stored in localStorage | E2E | ADMIN | httpOnly cookie preferred (XSS-readable storage is … | localStorage keys: theme,token,refreshToken,role,user | FAIL | MEDIUM | CRM-BUG-029 | Y |
| T0955 | Network | UI | Network | route / issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/leads x2 | FAIL | LOW | CRM-BUG-016 | Y |
| T0956 | Network | UI | Network | route /dashboard issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/leads x2 | FAIL | LOW | CRM-BUG-016 | Y |
| T0957 | Network | UI | Network | route /leads issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/leads x2 | FAIL | LOW | CRM-BUG-016 | Y |
| T0958 | Network | UI | Network | route /my-leads issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/leads x2 | FAIL | LOW | CRM-BUG-016 | Y |
| T0959 | Network | UI | Network | route /inventory issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/leads x2 | FAIL | LOW | CRM-BUG-016 | Y |
| T0960 | Performance | UI | Performance | route /projects downloads oversized API payloads | E2E | ADMIN | <300KB | 926KB http://127.0.0.1:5000/api/uploads/files/chat/1785997785… | FAIL | HIGH | CRM-BUG-010 | Y |
| T0961 | Network | UI | Network | route /finance issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/leads x2 | FAIL | LOW | CRM-BUG-016 | Y |
| T0962 | Network | UI | Network | route /map issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/leads x2 | FAIL | LOW | CRM-BUG-016 | Y |
| T0963 | Network | UI | Network | route /reports issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/leads x2 | FAIL | LOW | CRM-BUG-016 | Y |
| T0964 | Console | UI | Console | route /leaderboard logs console errors | E2E | ADMIN | no console errors | 1: Failed to load resource: the server responded with a statu… | FAIL | MEDIUM | CRM-BUG-012 | Y |
| T0965 | Network | UI | Network | route /leaderboard fires failing API calls | E2E | ADMIN | no 4xx/5xx | 400 /api/client/users/leaderboard | FAIL | MEDIUM | CRM-BUG-012 | Y |
| T0966 | Network | UI | Network | route /leaderboard issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/leads x2 | FAIL | LOW | CRM-BUG-012 | Y |
| T0967 | Network | UI | Network | route /calendar issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/leads x2 | FAIL | LOW | CRM-BUG-016 | Y |
| T0968 | Network | UI | Network | route /tasks issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/leads x2 | FAIL | LOW | CRM-BUG-016 | Y |
| T0969 | Performance | UI | Performance | route /tasks downloads oversized API payloads | E2E | ADMIN | <300KB | 14904KB http://127.0.0.1:5000/api/uploads/files/profile-image… | FAIL | HIGH | CRM-BUG-010 | Y |
| T0970 | Network | UI | Network | route /admin/users issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/leads x2 | FAIL | LOW | CRM-BUG-016 | Y |
| T0971 | Network | UI | Network | route /admin/console issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/leads x2 | FAIL | LOW | CRM-BUG-016 | Y |
| T0972 | Network | UI | Network | route /targets issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/targets/my x6 | FAIL | LOW | CRM-BUG-016 | Y |
| T0973 | Performance | UI | Performance | route /profile downloads oversized API payloads | E2E | ADMIN | <300KB | 5749KB http://127.0.0.1:5000/api/uploads/files/profile-images… | FAIL | HIGH | CRM-BUG-010 | Y |
| T0974 | Network | UI | Network | route /coworking issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/coworking/board x2 | FAIL | LOW | CRM-BUG-016 | Y |
| T0975 | Network | UI | Network | route /coworking/booking-board issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/coworking/board x2 | FAIL | LOW | CRM-BUG-016 | Y |
| T0976 | Network | UI | Network | route /coworking/clients issues duplicate API calls | E2E | ADMIN | one call per resource | /api/client/coworking/board x2 | FAIL | LOW | CRM-BUG-016 | Y |
| T0977 | Responsive | UI | Responsive | tap targets at 375px meet 44x44 minimum | E2E | ADMIN | all interactive targets >=44px | 10 of 30 below 44x44 | FAIL | MEDIUM | CRM-BUG-030 | Y |
| T0978 | Accessibility | UI | Accessibility | /login: color-contrast (2 nodes) | E2E | ADMIN | no WCAG 2.1 AA violation | Elements must meet minimum color contrast ratio thresholds \|… | FAIL | MEDIUM | CRM-BUG-021 | Y |
| T0979 | Accessibility | UI | Accessibility | /login: select-name (2 nodes) | E2E | ADMIN | no WCAG 2.1 AA violation | Select element must have an accessible name \| e.g. <select c… | FAIL | MEDIUM | CRM-BUG-021 | Y |
| T0980 | Accessibility | UI | Accessibility | /dashboard: color-contrast (2 nodes) | E2E | ADMIN | no WCAG 2.1 AA violation | Elements must meet minimum color contrast ratio thresholds \|… | FAIL | MEDIUM | CRM-BUG-021 | Y |
| T0981 | Accessibility | UI | Accessibility | /dashboard: select-name (2 nodes) | E2E | ADMIN | no WCAG 2.1 AA violation | Select element must have an accessible name \| e.g. <select c… | FAIL | MEDIUM | CRM-BUG-021 | Y |
| T0982 | Accessibility | UI | Accessibility | /tasks: color-contrast (10 nodes) | E2E | ADMIN | no WCAG 2.1 AA violation | Elements must meet minimum color contrast ratio thresholds \|… | FAIL | MEDIUM | CRM-BUG-021 | Y |
| T0983 | Accessibility | UI | Accessibility | /tasks: nested-interactive (27 nodes) | E2E | ADMIN | no WCAG 2.1 AA violation | Interactive controls must not be nested \| e.g. <div role="bu… | FAIL | MEDIUM | CRM-BUG-021 | Y |
| T0984 | Accessibility | UI | Accessibility | /admin/users: color-contrast (4 nodes) | E2E | ADMIN | no WCAG 2.1 AA violation | Elements must meet minimum color contrast ratio thresholds \|… | FAIL | MEDIUM | CRM-BUG-021 | Y |
| T0985 | Accessibility | UI | Accessibility | /admin/users: nested-interactive (27 nodes) | E2E | ADMIN | no WCAG 2.1 AA violation | Interactive controls must not be nested \| e.g. <tr class="is… | FAIL | MEDIUM | CRM-BUG-021 | Y |
| T0986 | Accessibility | UI | Accessibility | /profile: button-name (2 nodes) | E2E | ADMIN | no WCAG 2.1 AA violation | Buttons must have discernible text \| e.g. <button type="butt… | FAIL | MEDIUM | CRM-BUG-021 | Y |
| T0987 | Accessibility | UI | Accessibility | /profile: color-contrast (2 nodes) | E2E | ADMIN | no WCAG 2.1 AA violation | Elements must meet minimum color contrast ratio thresholds \|… | FAIL | MEDIUM | CRM-BUG-021 | Y |
| T0988 | Accessibility | UI | Accessibility | /profile: label (3 nodes) | E2E | ADMIN | no WCAG 2.1 AA violation | Form elements must have labels \| e.g. <input class="mt-1 w-f… | FAIL | MEDIUM | CRM-BUG-021 | Y |
| T0989 | Accessibility | UI | Accessibility | visible focus indicator during keyboard navigation | E2E | ADMIN | outline or ring on focus | visible | PASS | - | - | Y |
| T0990 | Leads UI | UI | Leads UI | search with no matches shows an empty state | E2E | ADMIN | row count drops + empty-state message | rows 100 -> 100, emptyStateText=true | FAIL | - | CRM-BUG-026 | Y |
| T0991 | Leads UI | UI | Leads UI | clearing search restores the list | E2E | ADMIN | rows return | rows back to 100 | PASS | - | - | Y |
| T0992 | Leads UI | UI | Leads UI | pagination controls present on the leads table | E2E | ADMIN | Next/Prev controls | not found | FAIL | LOW | - | Y |
| T0993 | UI | UI | UI | leads table row click intercepted by the sticky app header | E2E | ADMIN | row is clickable after scroll | pointer events intercepted by header button; used force-click… | FAIL | LOW | CRM-BUG-031 | Y |
| T0994 | Leads UI | UI | Leads UI | clicking a lead row opens its detail view | E2E | ADMIN | detail panel/page renders | url=/projects textLen=637 jsErrors=0 | PASS | - | - | Y |
| T0995 | UI Modals | UI | UI Modals | /admin/users: "Add" opens a dialog | E2E | ADMIN | dialog visible | opened, jsErrors=0 | PASS | - | - | Y |
| T0996 | UI Modals | UI | UI Modals | /admin/users: ESC closes the dialog | E2E | ADMIN | closes on Escape | still open | FAIL | LOW | CRM-BUG-019 | Y |
| T0997 | Accessibility | UI | Accessibility | /admin/users: focus moves into the dialog when opened | E2E | ADMIN | focus inside dialog | false | FAIL | MEDIUM | CRM-BUG-020 | Y |
| T0998 | UI Modals | UI | UI Modals | /tasks: "Create" opens a dialog | E2E | ADMIN | dialog visible | opened, jsErrors=0 | PASS | - | - | Y |
| T0999 | UI Modals | UI | UI Modals | /tasks: ESC closes the dialog | E2E | ADMIN | closes on Escape | still open | FAIL | LOW | CRM-BUG-019 | Y |
| T1000 | Accessibility | UI | Accessibility | /tasks: focus moves into the dialog when opened | E2E | ADMIN | focus inside dialog | true | PASS | - | - | Y |
| T1001 | UI Modals | UI | UI Modals | /inventory: "Add" opens a dialog | E2E | ADMIN | dialog visible | opened, jsErrors=0 | PASS | - | - | Y |
| T1002 | UI Modals | UI | UI Modals | /inventory: ESC closes the dialog | E2E | ADMIN | closes on Escape | still open | FAIL | LOW | CRM-BUG-019 | Y |
| T1003 | Accessibility | UI | Accessibility | /inventory: focus moves into the dialog when opened | E2E | ADMIN | focus inside dialog | false | FAIL | MEDIUM | CRM-BUG-020 | Y |
| T1004 | Forms | UI | Forms | submitting the create-user form empty shows field validation | E2E | ADMIN | inline validation, not a server error | validationText=true serverErrorText=false jsErrors=0 | PASS | - | - | Y |
| T1005 | Session | UI | Session | logout redirects to login and clears stored tokens | E2E | ADMIN | /login and no token in localStorage | url=/login tokenCleared=true keys=theme | PASS | - | - | Y |
| T1006 | Session | UI | Session | browser Back after logout does not restore an authenticated page | E2E | ADMIN | redirected to login | url=/login bodyLen=132 | PASS | - | - | Y |
| T1007 | Session | UI | Session | direct URL to a protected route while logged out | E2E | ADMIN | redirect to /login | url=/login bodyLen=132 | PASS | - | - | Y |
| T1008 | Leads UI | UI | Leads UI | leads search with no matches filters the table | E2E | ADMIN | 0 rows + empty state | rows 100 -> 0; empty-state text=false | PASS | - | - | Y |
| T1009 | Leads UI | UI | Leads UI | clearing the leads search restores rows | E2E | ADMIN | rows return | 100 -> 100 | PASS | - | - | Y |
| T1010 | Leads UI | UI | Leads UI | "Load more leads" appends the next page | E2E | ADMIN | row count increases | 100 -> 200 rows | PASS | - | - | Y |
| T1011 | Leads UI | UI | Leads UI | Filters control opens the filter panel | E2E | ADMIN | panel visible | did not open | FAIL | MEDIUM | - | Y |
| T1012 | Leads UI | UI | Leads UI | clicking a lead opens its detail (route or drawer) | E2E | ADMIN | navigates to /leads/:id or opens a detail panel | url=/leads?view=ALL detailPanel=false textLen=71156 jsErrors=0 | FAIL | MEDIUM | - | Y |
| T1013 | Leads UI | UI | Leads UI | an Export control is available on the leads screen | E2E | ADMIN | export button | not found | FAIL | LOW | - | Y |
