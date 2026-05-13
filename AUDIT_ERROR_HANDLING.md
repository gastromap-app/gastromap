# Error Handling & Silent Failures Audit

**Date:** 2025-01-XX  
**Scope:** All React components, hooks, API layers, and mutations  
**Status:** 🔴 Multiple critical silent failure patterns found

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 CRITICAL | 7 | Silent failure patterns — user gets no feedback |
| 🟠 HIGH | 12 | Missing error handlers on mutations |
| 🟡 MEDIUM | 9 | Potential null/undefined crashes |
| 🟡 MEDIUM | 6 | Race conditions |

---

## 🔴 CRITICAL — Silent Failure Patterns

### C1. `updateProfileRole()` returns `{data, error}` without throwing

**File:** `src/shared/api/admin.api.js:105`

```javascript
export async function updateProfileRole(userId, role) {
    if (!supabase) return { error: 'No Supabase' }
    const { data, error } = await supabase
        .from('profiles').update({ role }).eq('id', userId).select().single()
    return { data, error }  // ← ERROR IS NEVER THROWN
}
```

**Impact:** When `useUpdateProfileRoleMutation` calls this function, the mutation resolves successfully even when the Supabase query fails. The `onSuccess` callback fires, cache is invalidated, and the user sees "updated successfully" — but nothing actually changed.

**Fix:** Either throw on error (like `updateUserStatus` does) or check the error in the mutation's `mutationFn`:
```javascript
export async function updateProfileRole(userId, role) {
    if (!supabase) throw new Error('No Supabase')
    const { data, error } = await supabase.from('profiles').update({ role }).eq('id', userId).select().single()
    if (error) throw error
    return data
}
```

---

### C2. `updateReviewStatus()` returns `{data, error}` without throwing

**File:** `src/shared/api/admin.api.js:218-224`

```javascript
export async function updateReviewStatus(reviewId, status, _comment) {
    const { data, error } = await supabase.from('reviews').update(updates).eq('id', reviewId).select().single()
    if (error) console.error('[admin.api] updateReviewStatus:', error.message)
    return { data, error }  // ← ERROR SWALLOWED, only logged
}
```

**Impact:** The `useUpdateReviewStatusMutation` will call `onSuccess` even when the review status update fails. Admin sees "approved" toast but the review remains pending.

**Fix:** Throw the error instead of returning it:
```javascript
if (error) throw new ApiError(error.message, 500, 'UPDATE_ERROR')
return data
```

---

### C3. `handleCulinarySearch` catches error but shows nothing to user

**File:** `src/features/admin/hooks/useAdminLocations.js:297-306`

```javascript
const handleCulinarySearch = async () => {
    if (!culinarySearchQuery.trim()) return
    try {
        const results = await spoonacularMutation.mutateAsync({ query: culinarySearchQuery })
        setCulinaryResults(results)
    } catch (error) {
        console.error('[Admin] Culinary Search failed:', error)
        // ← NO TOAST, NO USER FEEDBACK
    }
}
```

**Impact:** User clicks search, nothing happens, no error shown. They may retry indefinitely.

**Fix:** Add `setToast({ message: 'Culinary search failed', type: 'error' })` in the catch block.

---

### C4. `handleImproveText` catches error but shows nothing to user

**File:** `src/features/admin/hooks/useAdminLocations.js:396-421`

```javascript
const handleImproveText = async (field) => {
    // ...
    try {
        // AI improvement logic
    } catch (error) {
        console.error('AI improvement failed:', error)
        // ← NO TOAST, NO USER FEEDBACK
    } finally {
        setIsImproving(null)
    }
}
```

**Impact:** Admin clicks "Improve with AI", loading spinner appears and disappears, but no text changes and no error is shown.

**Fix:** Add `setToast({ message: 'AI improvement failed. Try again.', type: 'error' })`.

---

### C5. ProfilePage feedback submission — error caught but not shown

**File:** `src/features/dashboard/pages/ProfilePage.jsx:27-44`

```javascript
const handleSubmit = async () => {
    if (!message.trim()) return
    try {
        await sendFeedback.mutateAsync({ userId, type, message, metadata: {...} })
        setMessage('')
        onClose()
        onSuccess?.()
    } catch (error) {
        console.error('Failed to send feedback:', error)
        // ← NO USER NOTIFICATION
    }
}
```

**Impact:** User writes feedback, clicks submit, modal closes (via `onClose` not being called on error path — actually modal stays open but no error message shown). User doesn't know their feedback wasn't sent.

**Fix:** Add error state and display it in the modal UI.

---

### C6. `useSavedLocations` remove — no error feedback

**File:** `src/hooks/useSavedLocations.js:41-43`

```javascript
const remove = (locationId) => {
    if (user?.id) {
        removeMut.mutate({ userId: user.id, locationId })
        // ← NO onError handler, no toast
    }
}
```

**Impact:** User removes a favorite, optimistic update removes it from UI (via `useRemoveFavoriteMutation`'s `onMutate`), but if the API call fails, the item silently reappears on next refetch with no explanation.

**Fix:** The optimistic rollback in `useRemoveFavoriteMutation` handles the data revert, but the user still gets no notification. Add a toast callback or use the mutation's `isError` state in the UI.

---

### C7. `AdminMenuScannerPage` search fails silently

**File:** `src/features/admin/pages/AdminMenuScannerPage.jsx:60-65`

```javascript
} catch (err) {
    console.error('[AdminMenuScanner] Search failed:', err)
    setSearchResults([])
    // ← NO TOAST, user just sees empty results
}
```

**Impact:** Admin searches for a location, gets empty results with no indication that the search actually failed (vs. no results found).

**Fix:** Add `setToast({ type: 'error', message: 'Search failed' })`.

---

## 🟠 HIGH — Missing Error Handlers on Mutations

### H1. `deleteVisitMutation.mutate()` — no onError

**File:** `src/features/dashboard/pages/VisitedPage.jsx:167`

```javascript
const handleDelete = (visitId, locationId) => {
    deleteVisitMutation.mutate({ visitId, userId: user.id, locationId })
    // ← No onSuccess, no onError
}
```

**Impact:** If delete fails, user gets no feedback. The visit stays in the list but user thinks it was deleted.

---

### H2. `updateFeedbackStatus.mutate()` — no onError

**File:** `src/features/admin/pages/AdminModerationPage.jsx:411,418`

```javascript
onClick={() => updateFeedbackStatus.mutate({ id: item.id, status: 'resolved' })}
onClick={() => updateFeedbackStatus.mutate({ id: item.id, status: 'archived' })}
```

**Impact:** Admin clicks "Resolve" or "Archive" on feedback — if it fails, no error shown.

---

### H3. `deletePresence.mutate()` — no onError

**File:** `src/features/admin/pages/AdminDineWithMePage.jsx:137`

```javascript
onClick={() => deletePresence.mutate(p.id)}
```

**Impact:** Silent failure when deleting a dine presence.

---

### H4. `deleteWave.mutate()` — no onError

**File:** `src/features/admin/pages/AdminDineWithMePage.jsx:199`

```javascript
onClick={() => deleteWave.mutate(w.id)}
```

---

### H5. `updateStatus.mutate()` — no onError

**File:** `src/features/admin/pages/AdminDineWithMePage.jsx:304,311`

```javascript
onClick={() => updateStatus.mutate({ entryId: entry.id, status: 'approved' })}
onClick={() => updateStatus.mutate({ entryId: entry.id, status: 'rejected' })}
```

---

### H6. `deleteEntry.mutate()` — no onError

**File:** `src/features/admin/pages/AdminDineWithMePage.jsx:320`

```javascript
onClick={() => deleteEntry.mutate(entry.id)}
```

---

### H7. `updateReport.mutate()` — no onError

**File:** `src/features/admin/pages/AdminDineWithMePage.jsx:430,436`

```javascript
onClick={() => updateReport.mutate({ reportId: report.id, status: 'resolved' })}
onClick={() => updateReport.mutate({ reportId: report.id, status: 'dismissed' })}
```

---

### H8. `bulkReindexMutation.mutate()` — no onError

**File:** `src/features/admin/pages/AdminLocationsPage.jsx:180`

```javascript
bulkReindexMutation.mutate({ limit: 50, onlyMissing: true })
```

**Impact:** Bulk reindex fails silently. Admin has no idea if it worked.

---

### H9. `bulkEmbeddingMutation.mutate()` — no onError

**File:** `src/features/admin/pages/AdminLocationsPage.jsx:197`

```javascript
bulkEmbeddingMutation.mutate({ limit: 50, onlyEmpty: mode })
```

---

### H10. `bulkSyncKG.mutate()` — no onError

**File:** `src/features/admin/pages/AdminKnowledgeGraphPage.jsx:1002`

```javascript
onClick={() => bulkSyncKG.mutate()}
```

---

### H11. `embeddingMutation.mutate()` — no onError

**File:** `src/features/admin/components/LocationFormSlideOver.jsx:360`

```javascript
embeddingMutation.mutate(selectedLocation.id, {
    onSuccess: () => {
        console.log('[LocationForm] Embedding updated ✅')
    },
    // ← NO onError
})
```

---

### H12. `reindexMutation.mutate()` — no onError

**File:** `src/features/admin/components/LocationFormSlideOver.jsx:370`

```javascript
reindexMutation.mutate(selectedLocation.id, {
    onSuccess: (updated) => {
        setFormData(prev => ({ ...prev, ...updated }))
    }
    // ← NO onError
})
```

---

## 🟡 MEDIUM — Potential Null/Undefined Crashes

### N1. `selectedLocation.id` accessed without null check in handleSave

**File:** `src/features/admin/hooks/useAdminLocations.js:508`

```javascript
if (selectedLocation.id === 'NEW') {
```

While `formData` is null-checked above, `selectedLocation` is not checked before `.id` access. If `selectedLocation` is null (e.g., due to a race condition with `setSelectedLocation(null)` in a concurrent operation), this will throw.

---

### N2. `selectedLocation.id` in AdminMenuScannerPage without guard

**File:** `src/features/admin/pages/AdminMenuScannerPage.jsx:101,107,123,135`

```javascript
const result = await saveScannedMenu(selectedLocation.id, dishes)
```

The `selectedLocation` could be null if the user navigates away or the component re-renders. The `handleSelectLocation` sets it, but there's no guard in `handleSaveScan`.

---

### N3. `formData.must_try.split(',')` without type check

**File:** `src/features/admin/hooks/useAdminLocations.js:310`

```javascript
const currentTry = formData.must_try ? formData.must_try.split(',').map(s => s.trim()) : []
```

If `formData.must_try` is an array (which it can be based on `prepareFormData`), calling `.split()` on it will throw.

---

### N4. `user.id` accessed without null check in VisitedPage

**File:** `src/features/dashboard/pages/VisitedPage.jsx:167`

```javascript
deleteVisitMutation.mutate({ visitId, userId: user.id, locationId })
```

`user` comes from `useAuthStore()` and could be null if auth state changes.

---

### N5. `location.id` in LocationDetailsPage review submission

**File:** `src/features/public/pages/LocationDetailsPage.jsx:719`

```javascript
locationId: location.id,
```

If `location` is still loading or becomes null, this crashes.

---

### N6. Array methods on potentially undefined values in admin.api.js

**File:** `src/shared/api/admin.api.js:415-420`

```javascript
const [reviews, visits, locations, users] = await Promise.all([...])
const rv = reviews.data || []
```

If any of the Promise.all calls reject (network error), the entire destructuring fails with an unhandled rejection.

---

### N7. `formData[field]` in handleImproveText

**File:** `src/features/admin/hooks/useAdminLocations.js:398`

```javascript
const text = formData[field]
```

If `formData` is null (set to null after save), this throws.

---

### N8. `showModal?.data?.id` optional chaining inconsistency

**File:** `src/features/admin/pages/AdminKnowledgeGraphPage.jsx:820`

```javascript
if (showModal?.data?.id) {
    await updateCuisine.mutateAsync({ id: showModal.data.id, updates: data })
```

Safe here, but the pattern is inconsistent across the codebase.

---

### N9. `dinerId` in ReportDinerModal could be undefined

**File:** `src/features/dinewithme/components/ReportDinerModal.jsx:29`

```javascript
return reportDiner({ reportedId: dinerId, reason, details })
```

No validation that `dinerId` is defined before submitting.

---

## 🟡 MEDIUM — Race Conditions

### R1. Double-click on Save in useAdminLocations

**File:** `src/features/admin/hooks/useAdminLocations.js:447`

The `handleSave` function has no debounce or `isPending` guard. If the user clicks Save twice rapidly:
- Two `createLocMutation.mutate()` calls fire
- Two locations get created
- Both `onSuccess` callbacks fire, closing the slide-over

**Fix:** Add `if (createLocMutation.isPending || updateLocMutation.isPending) return` at the top of `handleSave`.

---

### R2. Double-click on delete in AdminDineWithMePage

**File:** `src/features/admin/pages/AdminDineWithMePage.jsx:137,199,320`

```javascript
onClick={() => deletePresence.mutate(p.id)}
onClick={() => deleteWave.mutate(w.id)}
onClick={() => deleteEntry.mutate(entry.id)}
```

No `disabled={mutation.isPending}` on these buttons. User can click multiple times.

---

### R3. `formData` stale closure in handleSave

**File:** `src/features/admin/hooks/useAdminLocations.js:447-548`

`handleSave` captures `formData` and `selectedLocation` from the closure. If the user edits a field and immediately clicks Save, the `formData` state may not yet reflect the latest keystroke (React batches state updates). The `setFormData(prev => ...)` pattern used for URL corrections partially mitigates this, but the `prepareSubmissionData` call uses the potentially stale `formData`.

**Fix:** Use a ref to track the latest formData, or pass formData as a parameter.

---

### R4. `handleRefresh` in DashboardPage — no error boundary

**File:** `src/features/dashboard/pages/DashboardPage.jsx:139-142`

```javascript
const handleRefresh = async () => {
    await useLocationsStore.getState().reinitialize()
}
```

If `reinitialize()` throws, the pull-to-refresh animation may get stuck in "refreshing" state with no error shown.

---

### R5. `handleLogout` — unhandled rejection

**File:** `src/features/admin/pages/AdminPage.jsx:12-15`

```javascript
const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
}
```

No try/catch. If `logout()` fails (network error), the redirect still happens, potentially leaving stale auth state.

---

### R6. `handleInstall` in InstallPrompt — unhandled rejection

**File:** `src/components/pwa/InstallPrompt.jsx:44-48`

```javascript
const handleInstall = async () => {
    if (!isIOS) {
        await installPWA()  // ← No try/catch
    }
    setVisible(false)
}
```

If `installPWA()` throws, the error is unhandled.

---

## 📋 API Layer Error Propagation Issues

### A1. `getRecentLocations()` swallows errors

**File:** `src/shared/api/admin.api.js:37-42`

```javascript
export async function getRecentLocations(limit = 5) {
    if (!supabase) return mockRecentLocations
    const { data } = await supabase.from('locations')...
    return data || []
    // ← `error` is never destructured or checked
}
```

---

### A2. `isFavorite()` swallows errors

**File:** `src/shared/api/favorites.api.js:32-34`

```javascript
export async function isFavorite(userId, locationId) {
    if (!supabase) return false
    const { data } = await supabase.from('user_favorites')...
    return !!data
    // ← `error` never checked
}
```

---

### A3. `hasVisited()` swallows errors

**File:** `src/shared/api/visits.api.js:51-54`

```javascript
export async function hasVisited(userId, locationId) {
    if (!supabase) return false
    const { data } = await supabase.from('user_visits')...
    return !!data
    // ← `error` never checked
}
```

---

### A4. `getDetailedEngagement()` — Promise.all without error handling

**File:** `src/shared/api/admin.api.js:414-420`

```javascript
const [reviews, visits, locations, users] = await Promise.all([
    supabase.from('reviews').select('status, rating'),
    supabase.from('user_visits').select('user_id'),
    supabase.from('locations').select('status'),
    supabase.from('profiles').select('role'),
])
```

Individual query errors are in `.error` property but never checked. If any query fails, the function returns partial/incorrect data silently.

---

### A5. Knowledge Graph `location_vibes` operations — fire and forget

**File:** `src/shared/api/knowledge-graph.api.js:1080-1084`

```javascript
await supabase.from('location_vibes').delete().eq('location_id', loc.id)
await supabase.from('location_vibes').insert(
    kgMatches.vibes.map(v => ({ location_id: loc.id, vibe_id: v.id }))
)
// ← No error checking on either operation
```

---

## ✅ Recommended Fixes (Priority Order)

### Immediate (CRITICAL)

1. **Fix `updateProfileRole` and `updateReviewStatus`** — make them throw on error like all other API functions
2. **Add `setToast` to all catch blocks** that currently only have `console.error`
3. **Add `onError` handlers** to all `.mutate()` calls that lack them (especially user-facing ones)

### Short-term (HIGH)

4. **Create a global mutation error handler** via React Query's `MutationCache`:
```javascript
const queryClient = new QueryClient({
    mutationCache: new MutationCache({
        onError: (error, _variables, _context, mutation) => {
            // Show toast for any unhandled mutation error
            if (!mutation.options.onError) {
                toast.error(error.message || 'Operation failed')
            }
        },
    }),
})
```

5. **Add `disabled={mutation.isPending}`** to all buttons that trigger mutations
6. **Add `isPending` guard** at the top of `handleSave` in `useAdminLocations`

### Medium-term (MEDIUM)

7. **Add null checks** before accessing `selectedLocation.id` and `user.id`
8. **Wrap `handleRefresh`** in try/catch with error state
9. **Use `Promise.allSettled`** instead of `Promise.all` in `getDetailedEngagement`
10. **Add error checking** to all Supabase queries that currently ignore the `error` return value

---

## Pattern Recommendation

For consistency across the codebase, adopt this pattern for all mutations:

```javascript
// In query definition (queries/*.js) — add onError at definition level:
export function useDeleteSomethingMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id) => { /* ... */ },
        onSuccess: () => { qc.invalidateQueries(...) },
        onError: (err) => {
            console.error('[Mutation] failed:', err)
            // Global handler will show toast
        },
    })
}

// In component — always check isPending:
<button
    onClick={() => mutation.mutate(id)}
    disabled={mutation.isPending}
>
```

For API functions, always throw on error:
```javascript
// ✅ CORRECT
const { data, error } = await supabase.from('table').select()
if (error) throw new ApiError(error.message, 500, error.code)
return data

// ❌ WRONG
const { data, error } = await supabase.from('table').select()
return { data, error }  // Caller won't know it failed
```
