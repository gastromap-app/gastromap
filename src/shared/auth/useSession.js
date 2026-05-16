/**
 * useSession  —  Single, deterministic auth gate for data hooks.
 *
 * This hook is the canonical auth gate for The_Query_Layer hooks
 * (`useLocations`, `useInfiniteLocations`, `useLocation`,
 * `useLocationsInBounds`, `useAdminLocationsQuery`). It exposes a
 * three-state machine `{ status: 'pending' | 'anon' | 'authed', user,
 * isAuthed }` that resolves exactly once per app boot from a single
 * subscription to `subscribeToAuthChanges`.
 *
 * Composition with `useAuthStore`:
 *   - `useAuthStore` continues to own identity, login/logout,
 *     register, profile updates, password reset, and the persisted
 *     `auth-storage` slice. It is the source of truth for the
 *     authenticated user record.
 *   - `useSession` is a thin selector + deterministic resolver. It
 *     reads the same Supabase auth events through the existing
 *     `subscribeToAuthChanges` helper in `@/shared/api/auth.api`.
 *   - The two views converge after the first auth callback fires.
 *     Data hooks read `useSession` only; non-data consumers (route
 *     guards, login forms) may keep reading `useAuthStore`.
 *
 * Key contracts (see design.md Section 3.1, requirements R3.1–R3.5):
 *   - `subscribeToAuthChanges` is invoked exactly once per app boot,
 *     guarded by the module-level `_subscribed` boolean. Even with
 *     React Strict Mode double-mounting or HMR remounts, no second
 *     subscription is created.
 *   - State is held in a module-level singleton observed via
 *     `React.useSyncExternalStore` over a memoised snapshot. Two
 *     consecutive `getSnapshot()` reads with no transition return the
 *     SAME object reference (required by `useSyncExternalStore` to
 *     avoid infinite re-renders).
 *   - A one-shot 5-second `setTimeout` is the only time-driven state
 *     mutation in this module. If neither the auth nor the anon
 *     callback has fired by 5 seconds, the timer transitions
 *     `status` to `'anon'` and emits
 *     `console.warn('[useSession] auth still pending after 5s')`
 *     exactly once (R3.5).
 *   - If the Supabase client is `null` (env not configured), the
 *     hook settles to `'anon'` immediately on first subscription.
 *   - If `subscribeToAuthChanges` throws on subscribe, the hook logs
 *     a single `console.error` and settles to `'anon'`.
 *
 * State machine:
 *
 *     [*] --> pending  (module init)
 *     pending --> authed  (auth callback with user)
 *     pending --> anon    (anon callback OR 5s warn timer OR supabase null)
 *     authed --> anon     (subsequent anon callback)
 *     anon --> authed     (subsequent auth callback)
 *
 * @see .kiro/specs/data-loading-architecture/design.md, Section 3.1
 *      "Components and Interfaces / useSession()".
 * @see .kiro/specs/data-loading-architecture/requirements.md,
 *      Requirement 3 "Single Auth Boundary (Auth-Gate Determinism)".
 */

import * as React from 'react'
import { subscribeToAuthChanges } from '@/shared/api/auth.api'
import { supabase } from '@/shared/api/client'

// ─── Module-level singleton state ────────────────────────────────────────
//
// `sessionState` is the mutable record observed by every consumer via
// `useSyncExternalStore`. Mutations go through `setState` so that a fresh
// memoised snapshot is produced and listeners are notified atomically.

/** @type {{ status: 'pending' | 'anon' | 'authed', user: ({ id: string, email?: string, role?: string } | null) }} */
let sessionState = { status: 'pending', user: null }

/**
 * Memoised snapshot returned by `getSnapshot`. Rebuilt only when
 * `sessionState` transitions. `useSyncExternalStore` requires a stable
 * reference between transitions to avoid infinite re-renders.
 *
 * @type {Readonly<{ status: 'pending' | 'anon' | 'authed', user: ({ id: string, email?: string, role?: string } | null), isAuthed: boolean }>}
 */
let cachedSnapshot = buildSnapshot(sessionState)

/** Set of listeners registered by `useSyncExternalStore` callers. */
const listeners = new Set()

/**
 * Whether the module has already issued its single
 * `subscribeToAuthChanges` call. Guards against double subscription on
 * HMR / React Strict Mode remount.
 */
let _subscribed = false

/** Handle for the `subscribeToAuthChanges` cleanup function (kept for HMR). */
let _unsubscribe = null

/** Handle for the one-shot 5-second warn timer; cleared once it fires or once the first callback resolves the gate. */
let _warnTimer = null

/** Guards the warn from being emitted more than once per module lifetime. */
let _warnFired = false

// ─── Internal helpers ────────────────────────────────────────────────────

/**
 * Build the public-facing snapshot from internal state. Frozen so
 * consumers cannot mutate it.
 */
function buildSnapshot(state) {
    return Object.freeze({
        status: state.status,
        user: state.user,
        isAuthed: state.status === 'authed',
    })
}

/**
 * Apply a state transition and notify listeners. Returns early when the
 * incoming state is byte-identical to the current state to avoid
 * spurious re-renders.
 */
function setState(next) {
    if (next.status === sessionState.status && next.user === sessionState.user) return
    sessionState = next
    cachedSnapshot = buildSnapshot(sessionState)
    for (const listener of listeners) {
        try {
            listener()
        } catch (err) {
            // A throwing listener must not stop other consumers from
            // receiving the notification.
            console.error('[useSession] listener threw', err)
        }
    }
}

function clearWarnTimer() {
    if (_warnTimer !== null) {
        clearTimeout(_warnTimer)
        _warnTimer = null
    }
}

/**
 * Lazily start the single auth subscription. Called the first time any
 * consumer subscribes via `useSyncExternalStore`. Subsequent calls are
 * no-ops because of the `_subscribed` guard.
 */
function startSubscription() {
    if (_subscribed) return
    _subscribed = true

    // ── Supabase not configured → settle to anon immediately ────────────
    if (!supabase) {
        setState({ status: 'anon', user: null })
        return
    }

    // ── Subscribe to the single auth event source ───────────────────────
    try {
        _unsubscribe = subscribeToAuthChanges(
            ({ user }) => {
                clearWarnTimer()
                setState({ status: 'authed', user: user || null })
            },
            () => {
                clearWarnTimer()
                setState({ status: 'anon', user: null })
            },
        )
    } catch (err) {
        console.error('[useSession] subscribe failed', err)
        setState({ status: 'anon', user: null })
        return
    }

    // ── 5-second one-shot warn timer (R3.5) ─────────────────────────────
    // The only time-driven state mutation in this module. Fires at most
    // once per app boot. If neither auth nor anon callback has resolved
    // the gate by 5 seconds, settle to anon and warn so the UI never
    // hangs in `pending` forever.
    _warnTimer = setTimeout(() => {
        _warnTimer = null
        if (sessionState.status === 'pending' && !_warnFired) {
            _warnFired = true
            // eslint-disable-next-line no-console
            console.warn('[useSession] auth still pending after 5s')
            setState({ status: 'anon', user: null })
        }
    }, 5000)
}

/**
 * Subscribe function passed to `useSyncExternalStore`. Adds the
 * listener, lazily starts the auth subscription on the first call, and
 * returns an unsubscribe function that removes only this listener.
 *
 * Note: we deliberately do NOT tear down the underlying
 * `subscribeToAuthChanges` subscription when the listener set becomes
 * empty. The auth gate exists for the entire app boot lifetime so that
 * subsequent mounts (route changes, page navigations) can read the
 * already-resolved state synchronously without re-subscribing.
 */
function subscribe(listener) {
    listeners.add(listener)
    startSubscription()
    return () => {
        listeners.delete(listener)
    }
}

/**
 * Snapshot accessor for `useSyncExternalStore`. Returns the memoised
 * snapshot reference so consecutive reads with no transition are
 * referentially equal.
 */
function getSnapshot() {
    return cachedSnapshot
}

// ─── Public hook ─────────────────────────────────────────────────────────

/**
 * @typedef {'pending' | 'anon' | 'authed'} SessionStatus
 *
 * @typedef {Object} SessionUser
 * @property {string} id
 * @property {string} [email]
 * @property {string} [role]
 *
 * @typedef {Object} SessionValue
 * @property {SessionStatus} status
 * @property {SessionUser | null} user
 * @property {boolean} isAuthed   True iff `status === 'authed'`.
 */

/**
 * The single, deterministic auth gate. Read this hook from data hooks
 * to gate `enabled:` clauses and to forward `{ isAuthed }` into the
 * locations API layer.
 *
 * @returns {SessionValue}
 */
export function useSession() {
    return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// ─── Test-only escape hatch ──────────────────────────────────────────────
//
// Exported under a leading-underscore name so consumers in production
// code do not import it. Tests that need to drive multiple property
// runs against the same module instance can call this to reset the
// singleton between runs (the property test in
// `src/__tests__/properties/auth-gate-determinism.property.test.js`
// uses `vi.resetModules()` so this is mostly a convenience for unit
// tests).
export function __resetSessionForTests() {
    clearWarnTimer()
    if (typeof _unsubscribe === 'function') {
        try { _unsubscribe() } catch { /* ignore */ }
    }
    _unsubscribe = null
    _subscribed = false
    _warnFired = false
    listeners.clear()
    sessionState = { status: 'pending', user: null }
    cachedSnapshot = buildSnapshot(sessionState)
}
