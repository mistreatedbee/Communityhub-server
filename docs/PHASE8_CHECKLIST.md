# Phase 8: Final Checklist and MongoDB-Only Assumptions

This document records the Phase 8 verification checklist and the MongoDB-only architecture assumptions for CommunityHub.

## Final checklist

| Requirement | Implementation |
| ----------- | -------------- |
| **License → create community (MongoDB)** | `onboarding.controller.ts` `claimLicense`: reads License/Plan from MongoDB; creates Tenant, Membership, TenantSettings, TenantHomepageSettings; updates License (claimedAt, claimedByUserId, claimedTenantId, status CLAIMED). All in MongoDB. |
| **Public landing from MongoDB** | `tenants.controller.ts` `getTenantPublic` and `getTenantPublicPreview` read Tenant, TenantSettings, TenantHomepageSettings, Events, Announcements from MongoDB. |
| **Member sees single community site** | Tenant context by slug; `getTenantContext` returns tenant + membership; frontend routes like `/c/:slug` and `/c/:slug/admin` align with `getMembershipRoute`. |
| **No member dashboard** | Backend restricts `GET /api/tenants/:tenantId/features/dashboard` to OWNER/ADMIN/MODERATOR. Members (MEMBER role) do not have access to the dashboard endpoint. |
| **Admin controls content** | Content and settings mutations use `requireTenantRole(['OWNER','ADMIN','MODERATOR'])` in tenantFeatures.routes.ts; uploads use the same in tenantUpload.routes.ts. |
| **Uploads from device only** | tenantUpload.controller.ts uses multer `memoryStorage()` and GridFS; no Supabase Storage. Files are uploaded from the client (device). |
| **Simple language** | Handled in frontend/copy; no backend changes. |
| **Tenant isolation** | Application-level only: requireTenantRole checks Membership in MongoDB; all tenant-scoped queries filter by `tenantId`. No RLS. See `docs/SECURITY_TENANT_ISOLATION.md`. |

## Promote tenant admin

- **POST** and **PUT** `/api/admin/users/:userId/promote-tenant` both delegate to `promoteUserToTenant`.
- Updates MongoDB **Membership** only (role OWNER or ADMIN, status ACTIVE); optionally creates a new **Tenant**. User document (global role) is unchanged.

## Home-settings persistence

- **GET** `/api/tenants/:tenantId/features/home-settings` and **PUT** (OWNER/ADMIN only) persist to MongoDB **TenantHomepageSettings** (tenantId, theme, sections, publishedAt). Branding, hero, and sections are stored there.

## MongoDB-only assumptions (summary)

| Area | Implementation |
| ---- | -------------- |
| **Database** | All data in MongoDB: User, Tenant, Membership, License, Plan, TenantSettings, TenantHomepageSettings, Announcement, Event, Resource, Group, etc. |
| **Auth** | JWT; user and session/refresh data in MongoDB. No Supabase Auth. |
| **Tenant isolation** | `requireTenantRole`, membership checks, and strict `tenantId` filtering on every tenant-scoped query. No RLS. |
| **File storage** | GridFS in MongoDB (tenantUpload.controller); file metadata/keys in MongoDB; upload/download scoped by `tenantId`. No Supabase Storage. |
| **License / tenant setup** | License and claim flow read/write MongoDB only; tenant branding and sections in Tenant + TenantHomepageSettings (and TenantSettings) in MongoDB. |
