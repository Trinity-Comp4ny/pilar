# API Versioning — Edge Functions

## Strategy

We version the Edge Functions API via the **`X-API-Version` request header** rather than the URL path. The current version is **`v1`**.

Why header-based:

- **Backward compatible**: existing clients that don't send the header keep working — the server treats them as the current version.
- **Stable URLs**: no need to rebrand `/functions/v1/foo` to `/functions/v1/foo-v2` in the Supabase project. Supabase's own path prefix (`/functions/v1/...`) refers to the platform API, not our application API.
- **Easy multi-version overlap**: a single function can branch on the validated version internally.

Every response also includes `X-API-Version` so clients can detect drift.

## Helpers

`supabase/functions/_shared/api-version.ts` exports:

- `API_VERSION` — current version constant (`"v1"`).
- `SUPPORTED_VERSIONS` — array of versions still served (used during deprecation overlap).
- `versionedResponse(data, status, req)` — JSON response with CORS + security headers + `X-API-Version`.
- `requireApiVersion(req)` — validates the `X-API-Version` header if present; returns `{ ok, version }` on success or `{ ok: false, error }` (a 400 Response) on unsupported value. Missing header is accepted (backward compat).

Existing functions are not refactored yet. New functions should adopt these helpers; existing ones can migrate opportunistically when touched.

## When to bump

Bump the major version (`v1` → `v2`) only on **breaking changes**:

- Removing or renaming a request/response field.
- Changing a field's type or semantics.
- Changing error code shape.
- Tightening validation in a way that rejects previously-valid input.

Non-breaking changes that **do not** require a bump:

- Adding optional request fields (with safe defaults).
- Adding response fields (clients should ignore unknown keys).
- Adding new endpoints.
- Internal refactors, performance, security fixes.

## Deprecation policy

When a new version ships:

1. Both versions run in parallel for **6 months** of overlap.
2. Add the old version to `SUPPORTED_VERSIONS` so `requireApiVersion` keeps accepting it.
3. Responses for deprecated versions should set `Deprecation: true` and `Sunset: <RFC1123 date>` headers — clients can log/upgrade based on these.
4. After the sunset date, remove the version from `SUPPORTED_VERSIONS`; requests with that header now get a 400.

## Adding `v2`

1. Bump `API_VERSION` to `"v2"` in `_shared/api-version.ts`.
2. Add `"v2"` to `SUPPORTED_VERSIONS` (keep `"v1"` during overlap).
3. Inside each function that has breaking changes, branch on the version returned by `requireApiVersion(req)`:
   ```ts
   const check = requireApiVersion(req);
   if (!check.ok) return check.error;
   if (check.version === "v2") {
     // new payload shape
   } else {
     // legacy v1 path
   }
   ```
4. Document the diff in this file under a `## Changelog` section.
5. Update client SDK (frontend) to opt into `v2` by sending `X-API-Version: v2`.
6. Schedule the v1 sunset 6 months out.

## Client opt-in

The frontend Supabase client should attach `X-API-Version: v1` to all function calls so we can monitor adoption. Clients without the header are assumed to be the current version; bumping the default header value is how we migrate the client fleet.
