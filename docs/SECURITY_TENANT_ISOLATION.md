# Security and Tenant Isolation (Application-Layer)

This document describes how tenant isolation and security are enforced in the CommunityHub API. **There is no RLS (Row Level Security).** Isolation is achieved entirely at the application layer using Express middleware and MongoDB query scoping.

## Pattern: Resolve → Check → Scope

Every tenant-scoped request follows this pattern:

1. **Resolve tenant**  
   Get the tenant identifier from the **route** (e.g. `req.params.tenantId`) or from a slug (`TenantModel.findOne({ slug })` then use `tenant._id`). For paths under `/api/tenants/:tenantId/...`, **only** `req.params.tenantId` should be used for scoping; do not trust `tenantId` from body or query for tenant-scoped operations (to prevent parameter substitution).

2. **Check role or membership**  
   Use `requireTenantRole(roles)` middleware and/or an explicit `ensureMembership(tenantId, userId)` in the controller. Users must have an active membership in the tenant and the required role (or be `SUPER_ADMIN`, which bypasses only the role check; controllers still receive the same `tenantId` from the URL and must scope all queries by it).

3. **Scope all reads and writes by tenantId**  
   Every MongoDB operation that touches tenant data must include `tenantId` in the filter: `find`, `findOne`, `findOneAndUpdate`, `updateOne`, `deleteOne`, etc. Never return or modify another tenant’s data.

### References

- **Middleware:** `src/middleware/requireTenantRole.ts` — resolves tenantId (preferring `req.params.tenantId`), validates ObjectId, checks membership and role; `SUPER_ADMIN` skips the membership check.
- **Controllers:** `src/controllers/tenants.controller.ts`, `src/controllers/tenantFeatures.controller.ts` — resolve tenant from route, call `ensureMembership` where no role middleware is applied, and include `tenantId` in every tenant-scoped query.

## File Access

- **Upload:** All tenant file upload routes are protected by `auth` and `requireTenantRole`. The controller sets `metadata.tenantId` from `req.params.tenantId` when writing to GridFS.
- **Download:** Before streaming a file, the handler must:
  1. Resolve the tenant from the route (`req.params.tenantId`).
  2. Verify the user has access (e.g. `ensureMembership(tenantId, userId)`).
  3. Load the file document from GridFS and enforce `file.metadata.tenantId === request tenantId` (e.g. `String(meta.tenantId) === String(tenantId)`). If it does not match, return 404.

See `src/controllers/tenantUpload.controller.ts` for the implementation of upload and `getTenantFile`.

## Super-Admin

- **Routes:** Super-admin actions live under `/api/admin`, protected by `auth` and `requireRole('SUPER_ADMIN')`. There is no tenant filter: list users, list tenants, update user role/status, promote user to tenant, create/update/delete tenant are global.
- **Tenant-scoped routes:** Under `/api/tenants/:tenantId/...`, the `requireTenantRole` middleware lets `SUPER_ADMIN` skip the membership check, but the request still carries the same `tenantId` from the URL. Controllers must **always** scope MongoDB queries by this `tenantId`; super-admin must not be used to bypass tenant scoping or return another tenant’s data.

## No Supabase or RLS

Tenant isolation does not rely on Supabase, Postgres RLS, or any database-level policy. It is enforced only by:

- Express middleware (`auth`, `requireTenantRole`, `requireRole`).
- Controller logic that resolves tenant, checks membership where needed, and includes `tenantId` in every MongoDB filter for tenant-scoped data.
