# Knowledge Graph & AI Integration Task Tracking

## Status
- [x] Step 1: Database Migrations (Verified as already applied)
- [ ] Step 2: Import Enrichment Data
    - [ ] Create import script
    - [ ] Run import script
    - [ ] Verify enrichment data in DB
- [ ] Step 3: Implement API Logic
    - [ ] Update `src/shared/api/locations.api.js` with `enrichLocationWithAI`
    - [ ] Integrate into `createLocation` and `updateLocation`
- [ ] Step 4: Connect AI Guide
    - [ ] Implement `semanticSearch` in `src/shared/api/ai.api.js`
    - [ ] Integrate into `executeTool`
- [ ] Step 5: Final Validation
    - [ ] Test AI Guide with semantic queries
    - [ ] Audit KG data population

## Notes
- Migrations `20260328_knowledge_graph.sql` and `20260331_knowledge_graph_ontology.sql` are active.
- `tmp/enrichment_results.json` contains vectors and keywords for existing locations.
