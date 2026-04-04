# Plan: Operationalize Admin Locations Management

## 1. Analysis & Refinement
- [ ] Verify `AdminLocationsPage.jsx` state management for search and filters.
- [ ] Confirm `locations.api.js` correctly handles `must_try` as an array in DB and string in UI.
- [ ] Check `useAppConfigStore` usage to ensure AI features only show when configured.

## 2. UI/UX Enhancements
- [ ] **Filters**: Add a status filter (All, Active, Pending, Rejected) to the Locations list.
- [ ] **Action Menu**: Implement the dropdown menu in each table row (Edit, Show details, Delete).
- [ ] **Moderation Tab**:
    - [ ] Update the tab header to show the count of pending items: `Moderation (5)`.
    - [ ] Ensure "Approve" button correctly triggers `useUpdateLocationStatusMutation`.
- [ ] **SlideOver Form**:
    - [ ] Improve layout with distinct sections (General, Contact, Gastro Info, Media).
    - [ ] Make "Gastro AI" magic button more prominent for description and insider tips.
    - [ ] Add field validation (name, category, coordinates).

## 3. Gastro AI Integration
- [ ] Wire up the "AI Magic" button in `AdminLocationsPage.jsx` to `useAIQueryMutation`.
- [ ] Implement a logic that can auto-fill multiple fields (Description, Price, Must Try) from just the restaurant name and location.
- [ ] Add "Improve with AI" buttons next to textarea fields.

## 4. Final Verification
- [ ] Test full CRUD cycle (Create -> Preview -> Edit -> Delete).
- [ ] Verify moderation flow (Pending -> Active).
- [ ] Check mobile responsiveness of the Admin panel.
- [ ] Run `python .agent/scripts/checklist.py .` for final audit.
