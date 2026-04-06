# Task: Knowledge Graph Admin Optimization & Debugging

## Context
Following a database migration, the Knowledge Graph (KG) administration panel needs synchronization between its AI agents and the global application configuration. Current issues include hardcoded API keys/models and outdated styling.

## Goals
1. **Unify AI Logic**: Move enrichment logic to `kg-ai-agent.api.js`.
2. **Dynamic Configuration**: Integrate `useAppConfigStore` for API keys and model selection.
3. **UI/UX Modernization**: Apply "Industrial Amber & Slate" style (Sharp geometry, No Purple).
4. **Reliability**: Improve JSON parsing and model cascading for enrichment tasks.

## Implementation Steps

### Phase 1: API Layer (`src/shared/api/kg-ai-agent.api.js`)
- [ ] Add `callEnrichmentAI` function.
- [ ] Implement model cascade using `useAppConfigStore`.
- [ ] Integrate `KGDebug` for enrichment sessions.
- [ ] Ensure robust JSON parsing (handling markdown fences).

### Phase 2: Component Refactoring (`src/features/admin/components/KGEnrichmentAgent.jsx`)
- [ ] Replace internal `enrichCuisineWithAI` with new API call.
- [ ] Implement "Industrial Amber & Slate" design.
    - [ ] Replace `rounded-[28px]` with `rounded-sm` (4px).
    - [ ] Change colors: Violet -> Amber/Slate.
    - [ ] Add staggered animations for progress items.
- [ ] Display current model name during generation.

### Phase 3: Page Integration (`src/features/admin/pages/AdminKnowledgeGraphPage.jsx`)
- [ ] Verify `onEnriched` callback correctly saves data to Supabase via proxy.
- [ ] Check for data synchronization lags.

### Phase 4: Validation
- [ ] Test enrichment with different models.
- [ ] Verify `KGDebug` logs.
- [ ] Check mobile responsiveness of the updated component.
