# Task: Phase 1 - Stabilization & Cleanup

## 🎯 Goal
Resolve all critical linting errors and stabilize the Admin panel to prepare for AI integration.

## 📋 Breakdown

### 1. Hook Stabilization (Cascading Renders)
- [ ] Refactor `src/hooks/usePWA.js`: Move `setIsInstalled` login out of synchronous `useEffect` block.
- [ ] Refactor `src/hooks/useTheme.js`: Fix unused variables and ensure theme updates are handled correctly.
- [ ] Refactor `src/hooks/useI18n.js`: Fix synchronous `setCurrentLang` in `useEffect`.

### 2. Admin Panel Cleanup
- [ ] `src/features/admin/pages/AdminLocationsPage.jsx`:
    - Remove unused imports and variables.
    - Fix `Date.now()` purity issues in render.
    - Refactor logic to avoid `set-state-in-effect` errors.
- [ ] `src/features/admin/pages/AdminDashboardPage.jsx`:
    - Fix `formatTimeAgo` usage of `Date.now()`.

### 3. Knowledge Graph CRUD Completion
- [ ] `src/features/admin/pages/AdminKnowledgeGraphPage.jsx`:
    - Implement Modal for adding/editing Dishes.
    - Implement Modal for adding/editing Ingredients.
    - Ensure sync with `knowledge-graph.api.js`.

### 4. General Cleanup & API Hardening
- [ ] `src/shared/api/ai.api.js`:
    - Fix `no-control-regex` and `no-useless-escape`.
    - Fix empty blocks and unused variables.
- [ ] `src/shared/api/queries.js`:
    - Fix unused variables in query hooks.

### 5. Verification
- [ ] Run `npm run lint` and ensure 0 errors.
- [ ] Run `npm run build` to verify production stability.

## 🏗️ Technical Notes
- **FSD Compliance**: Maintain feature isolation in `src/features/admin`.
- **Purity**: React hooks must be pure; move side effects with state updates into event handlers or proper `useEffect` patterns.
- **Supabase**: Use existing RPCs and mutations from `src/shared/api`.
