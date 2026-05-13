# GastroMap — Auth, RLS & Data Access Security Audit

**Date:** 2026-05-13  
**Scope:** Authentication flow, Row Level Security policies, data access controls  
**Stack:** React + Supabase (PostgREST) + Vercel Serverless Functions

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 3 |
| MEDIUM | 4 |
| LOW | 3 |

---

## CRITICAL — Security Vulnerabilities

### C1. Privilege Escalation via Profile Self-Update (Role Field Unprotected)

**Location:** `supabase/migrations/003_profiles.sql` — policy `"profiles: own update"`

The RLS policy allows users to update their own profile row with only an ownership check:

```sql
CREATE POLICY "profiles: own update"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
```

Combined with `GRANT SELECT, UPDATE ON public.profiles TO authenticated`, there is **no column-level restriction** preventing a user from issuing:

```sql
UPDATE profiles SET role = 'admin' WHERE id = auth.uid();
```

There is no trigger that resets the role, no column-level GRANT restricting which columns `authenticated` can UPDATE, and no `WITH CHECK` clause that validates `role = OLD.role`.

**Impact:** Any authenticated user can escalate themselves to admin.

**Fix (choose one):**
1. Add a BEFORE UPDATE trigger that prevents role changes unless the caller is admin.
2. Revoke broad UPDATE and grant column-specific UPDATE:
   ```sql
   REVOKE UPDATE ON public.profiles FROM authenticated;
   GRANT UPDATE (full_name, avatar_url, bio, preferences) ON public.profiles TO authenticated;
   ```
3. Add a WITH CHECK that enforces `role = (SELECT role FROM profiles WHERE id = auth.uid())`.

---

### C2. `user_visits` Table Granted SELECT to `anon` Without Column Restriction

**Location:** `supabase/migrations/20260414_fix_rls_recursion.sql` line 95

```sql
GRANT SELECT ON public.user_visits TO anon;
```

The `user_visits` table contains per-user visit history (user_id, location_id, visited_at, rating, review_text). While RLS policies restrict SELECT to `auth.uid() = user_id`, the `anon` role has no `auth.uid()` — meaning the RLS policy `"Users can view own visits"` evaluates to FALSE for anon, so no rows are returned.

However, the admin policy `"Admins can manage all visits"` uses `get_my_role() = 'admin'`. For anon users, `get_my_role()` returns NULL (no profile row), so this also evaluates to FALSE.

**Current risk:** LOW in practice (RLS blocks access), but the GRANT is unnecessary and violates least-privilege. If any future policy adds a permissive SELECT (e.g., for leaderboard), all visit data becomes exposed.

**Fix:** Revoke the anon grant:
```sql
REVOKE SELECT ON public.user_visits FROM anon;
```

---

## HIGH — RLS Policy Gaps

### H1. `profiles` Table Granted SELECT to `anon` — Exposes Email & Role

**Location:** `supabase/migrations/20260414_fix_rls_recursion.sql` line 95

```sql
GRANT SELECT ON public.profiles TO anon;
```

The profiles table contains `email`, `role`, `status`, `last_active_at`. The RLS policies only allow:
- Own read (`auth.uid() = id`)
- Admin read all (`get_my_role() = 'admin'`)

For anon, both evaluate to FALSE, so no rows are returned. But like C2, this is an unnecessary privilege that could become dangerous if a permissive policy is added later (e.g., for public leaderboard display).

**Fix:** Either revoke the grant or add column-level restrictions:
```sql
REVOKE SELECT ON public.profiles FROM anon;
-- Or if needed for leaderboard:
GRANT SELECT (id, full_name, avatar_url) ON public.profiles TO anon;
```

---

### H2. `user_roles` Table Missing Explicit RLS Enable in Initial Migration

**Location:** `supabase/migrations/20260331_payments_system.sql`

The `user_roles` table is created but **RLS is never explicitly enabled** in this migration. The `20260414_fix_rls_recursion.sql` adds a policy for it but doesn't include `ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY`.

If RLS was never enabled on this table, the admin policy is meaningless — all rows are visible to any authenticated user. This means any user can query `user_roles` to discover who is admin.

**Fix:**
```sql
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
```

---

### H3. KG Save Endpoint Role Check Queries `user_roles` Instead of `profiles`

**Location:** `api/kg/save.js` lines 88-97

The endpoint verifies the user's role by querying `user_roles` table:
```javascript
const { data: roleData } = await fetch(`${cleanUrl}/rest/v1/user_roles?user_id=eq.${user.id}&select=role&limit=1`, ...)
```

But the application's primary role source is `profiles.role`, not `user_roles.role`. These tables may be out of sync. A user could be admin in `profiles` but not in `user_roles`, or vice versa.

**Impact:** Inconsistent authorization — admin users may be denied KG write access, or non-admin users with stale `user_roles` entries could retain access.

**Fix:** Query `profiles.role` instead, or ensure both tables are always synchronized.

---

## MEDIUM — Auth Flow Issues

### M1. Token Stored in Zustand/localStorage — Accessible to XSS

**Location:** `src/shared/store/useAuthStore.js`

The auth store persists `token` to localStorage under key `auth-storage`. While this is standard for SPAs using Supabase, any XSS vulnerability would allow token theft. The Supabase client also stores the session under `sb-gastromap-auth`.

**Mitigation:** This is an accepted trade-off for SPAs. Ensure strict CSP headers and input sanitization. Consider using `httpOnly` cookies via a BFF pattern for sensitive operations.

---

### M2. Web Locks Bypass Creates Multi-Tab Token Refresh Race

**Location:** `src/shared/api/client.js` lines 25-32

```javascript
lock: async (_name, _acquireTimeout, fn) => fn(),
```

The no-op lock prevents deadlocks but means multiple tabs can refresh tokens simultaneously. This can cause:
- One tab invalidates the refresh token before another tab uses it
- Brief periods where one tab has an expired token

**Current mitigation:** `autoRefreshToken: true` and `persistSession: true` handle most cases. The comment acknowledges this trade-off.

**Risk:** LOW — Supabase handles refresh token rotation gracefully in most cases.

---

### M3. Session Expiry Handling — 60-Second Clock Skew Tolerance

**Location:** `src/shared/api/auth.api.js` — `subscribeToAuthChanges()`

```javascript
if (session.expires_at < nowSec - 60) {
    onSignOut()
    return
}
```

The 60-second tolerance means a token that expired up to 60 seconds ago is still accepted locally. This is reasonable for clock skew but means the UI may briefly show authenticated state with an expired token before the next API call fails.

**Current handling:** Good — expired sessions trigger `onSignOut()`, and `autoRefreshToken: true` proactively refreshes before expiry.

---

### M4. Admin Email Fallback Grants Admin Without DB Verification

**Location:** `src/shared/api/auth.api.js` — `_mapUser()` function

```javascript
role: (profile?.role && profile.role !== 'user')
    ? profile.role
    : ADMIN_EMAILS.includes(authUser.email)
        ? 'admin'
        : (profile?.role || 'user'),
```

If the profile fetch fails or returns `role: 'user'`, any email in `VITE_ADMIN_EMAILS` is granted admin role client-side. While RLS still enforces server-side checks (the DB profile.role is what matters for RLS), this creates a confusing state where the UI shows admin access but API calls may fail.

**Risk:** LOW for data access (RLS is the real gate), but could expose admin UI routes to non-admin users whose email matches the env var.

---

## MEDIUM — Data Exposure Risks

### D1. `reviews` Table — `review_text` Restricted for Anon but Visible to Authenticated

**Location:** `supabase/migrations/20260511_anon_column_grant.sql`

Anon users can only see `id, location_id, rating, status, created_at` on reviews. However, authenticated users have full SELECT on reviews (via `GRANT SELECT ON public.reviews TO authenticated` implied by default). Combined with the policy `"Anyone can view published reviews"`, any authenticated user can read all published review texts.

**Assessment:** This is likely intentional (authenticated users should see reviews). Not a vulnerability, but worth documenting.

---

### D2. `get_leaderboard()` Function Exposes Email Addresses

**Location:** `supabase/migrations/20260502_audit_fixes.sql`

The `get_leaderboard()` function returns `p.email` for all users. Since it's `SECURITY DEFINER`, it bypasses RLS. If this function is callable by anon/authenticated users, it leaks all user emails.

**Fix:** Remove `email` from the return type, or restrict execution to admin:
```sql
REVOKE EXECUTE ON FUNCTION get_leaderboard() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard() TO authenticated; -- if needed for leaderboard UI
```
And remove the `email` column from the return.

---

## LOW — Minor Issues

### L1. Admin Queries Don't Check Role — Rely on Route Guard Only

**Location:** `src/shared/api/queries/admin.queries.js`

None of the admin query hooks (e.g., `useAdminStats`, `useProfiles`, `usePendingReviews`) check the user's role before firing. They rely entirely on:
1. The `RequireAdmin` route guard (client-side)
2. RLS policies (server-side)

**Assessment:** This is acceptable because RLS is the real security boundary. Even if a user bypasses the route guard (e.g., via DevTools), the RLS policies will return empty results or errors. However, adding `enabled: user?.role === 'admin'` would prevent unnecessary failed requests.

---

### L2. `useAdminLocationsQuery` Uses `isAuthenticated` Not `isAdmin`

**Location:** `src/shared/api/queries/location.queries.js` line 33

```javascript
enabled: isAuthenticated,
```

This means the query fires for any authenticated user, not just admins. The RLS policy will return only active/approved locations for non-admin users (via the public read policy), which is correct but wasteful — a non-admin user on an admin page would get public data instead of an error.

**Fix:** Change to:
```javascript
const user = useAuthStore(s => s.user)
enabled: isAuthenticated && user?.role === 'admin',
```

---

### L3. Mock Mode Accepts Any Email as Login

**Location:** `src/shared/api/auth.api.js` — `signIn()` mock path

When Supabase is not configured, any email/password combination succeeds. This is dev-only behavior and acceptable, but ensure `USE_SUPABASE` is always true in production (it is, since env vars are set on Vercel).

---

## Positive Findings (What's Done Well)

1. **Admin route guard is solid:** `RequireAdmin` checks `isAuthenticated`, `user` existence, and `user.role === 'admin'` before rendering admin routes. Non-admin users are redirected to `/dashboard`.

2. **RLS is enabled on all critical tables:** Multiple migrations ensure RLS is enabled, and the `20260429_enable_rls_missing_tables.sql` migration caught tables that were missed initially.

3. **`get_my_role()` SECURITY DEFINER pattern:** Prevents infinite recursion in RLS policies and provides a clean, non-recursive way to check admin status.

4. **Column-level grants for anon on locations:** The `20260511_anon_column_grant.sql` migration properly restricts anon users from seeing `insider_tip`, `phone`, `booking_url`, and other sensitive columns.

5. **Service role key is server-side only:** The `SUPABASE_SERVICE_ROLE_KEY` is only used in Vercel serverless functions (`api/` folder) and CLI scripts (`scripts/` folder), never in client-side code.

6. **Token refresh is handled:** `autoRefreshToken: true` + the `TOKEN_REFRESHED` event handler in `subscribeToAuthChanges()` keeps sessions alive and re-fetches profiles to sync role changes.

7. **KG save endpoint validates JWT:** The `/api/kg/save` endpoint verifies the JWT against Supabase Auth and checks role before allowing writes.

8. **Security hardening migration:** `20260423_security_hardening.sql` sets `search_path` on all functions (prevents function hijacking) and removes dangerous storage listing policies.

---

## Recommended Fixes (Priority Order)

| # | Fix | Severity | Effort |
|---|-----|----------|--------|
| 1 | Add column-level UPDATE grant on profiles (prevent role self-escalation) | CRITICAL | Low |
| 2 | Enable RLS on `user_roles` table | HIGH | Low |
| 3 | Revoke unnecessary `GRANT SELECT ON user_visits TO anon` | HIGH | Low |
| 4 | Add column-level SELECT grant on profiles for anon (or revoke entirely) | HIGH | Low |
| 5 | Remove `email` from `get_leaderboard()` return | MEDIUM | Low |
| 6 | Fix KG save endpoint to check `profiles.role` instead of `user_roles.role` | MEDIUM | Low |
| 7 | Add `user?.role === 'admin'` to admin query `enabled` guards | LOW | Low |

---

## Migration SQL for Critical Fixes

```sql
-- Fix C1: Prevent role self-escalation
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, name, avatar_url, bio, preferences) ON public.profiles TO authenticated;

-- Fix H2: Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Fix C2/H1: Revoke unnecessary anon grants
REVOKE SELECT ON public.user_visits FROM anon;
REVOKE SELECT ON public.profiles FROM anon;
-- If leaderboard needs anon access:
-- GRANT SELECT (id, full_name, avatar_url) ON public.profiles TO anon;

-- Fix D2: Remove email from leaderboard
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  avatar_url TEXT,
  places_visited BIGINT,
  reviews_written BIGINT,
  places_saved BIGINT,
  total_points BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    COALESCE(p.full_name, p.name) AS name,
    p.avatar_url,
    COALESCE(v.places_visited, 0) AS places_visited,
    COALESCE(r.reviews_written, 0) AS reviews_written,
    COALESCE(f.places_saved, 0) AS places_saved,
    (COALESCE(v.places_visited, 0) * 10 +
     COALESCE(r.reviews_written, 0) * 25 +
     COALESCE(f.places_saved, 0) * 5) AS total_points
  FROM profiles p
  LEFT JOIN (SELECT user_id, COUNT(*) AS places_visited FROM user_visits GROUP BY user_id) v ON v.user_id = p.id
  LEFT JOIN (SELECT user_id, COUNT(*) AS reviews_written FROM reviews WHERE status IN ('approved','published') GROUP BY user_id) r ON r.user_id = p.id
  LEFT JOIN (SELECT user_id, COUNT(*) AS places_saved FROM user_favorites GROUP BY user_id) f ON f.user_id = p.id
  ORDER BY total_points DESC;
END;
$$;
```
