# PLAN: Modular Refactoring of React Query Layer

## 🎯 Goal
Modularize the massive `src/shared/api/queries.js` (1180+ lines) into domain-specific files while ensuring 100% backward compatibility.

## 🏗️ Architecture Audit
The current implementation relies on:
1. **Dynamic Imports**: Used inside hooks to prevent circular dependencies between queries and API modules.
2. **Global Query Keys**: Centralized object `queryKeys` used for cache invalidation.
3. **Zustand Sync**: Success handlers (`onSuccess`) update the global state in `useLocationsStore` and others.

## 🛡️ Safety Strategy (Zero-Downtime Refactor)
- **Step 1: Shadow Implementation**: Build the new modular structure in a sub-directory.
- **Step 2: Proxy Interface**: Update the original `queries.js` to act as a proxy (re-exporting everything from the new modules).
- **Step 3: Verification**: Verify that existing imports (e.g., `import { useLocation } from '@/shared/api/queries'`) still resolve correctly.
- **Step 4: Dependency Check**: Ensure `../` relative paths in new modules correctly point to the same API files as `./` in the old file.

## 📋 Task Breakdown

### Phase 1: Foundation (Done/In Progress)
- [x] Create `src/shared/api/queries/` directory.
- [x] Create `queryKeys.js` (Central keys).
- [x] Extract **Locations & Geo** hooks to `location.queries.js`.
- [x] Extract **Admin & Stats** hooks to `admin.queries.js`.
- [x] Extract **AI & KG** hooks to `ai.queries.js`.
- [x] Extract **Taxonomy** hooks to `knowledge.queries.js`.

### Phase 2: Completion
- [ ] **Social Domain**: Create `social.queries.js` (Reviews, Favorites, Visits, Leaderboard).
- [ ] **User Domain**: Create `user.queries.js` (Preferences).
- [ ] **Main Hub**: Create `index.js` re-exporting ALL modules.

### Phase 3: Transition & Validation
- [ ] Update original `src/shared/api/queries.js` to:
  ```javascript
  export * from './queries/index';
  ```
- [ ] **Code Audit**: Check for any missing exports (constants or helper functions).
- [ ] **Build Test**: Run `npm run build` to ensure Vite resolves everything correctly.

## 🧪 Verification Checklist
- [ ] Admin Locations Page: Filters and Table work.
- [ ] Map View: Locations fetch and display correctly.
- [ ] Location Details: Reviews and KG data load.
- [ ] User Profile: Favorites and Preferences load/save.
- [ ] AI Chat: Analysis and extraction mutations work.

## ⚠️ Potential Pitfalls
- **Relative Paths**: If an API file is imported as `../admin.api`, it must exist.
- **Export Collisions**: Ensure no two modules export the same hook name.
- **Missing Keys**: Verify `queryKeys` exported from the new file is identical to the old one.
