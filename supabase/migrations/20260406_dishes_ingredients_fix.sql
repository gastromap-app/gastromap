-- ═══════════════════════════════════════════════════════════════════════════
-- KG DISHES FIX — Add missing 'ingredients' column
-- Date: 2026-04-06
-- Error: PGRST204 — Could not find the 'ingredients' column of 'dishes'
-- The column was defined in 20260328_knowledge_graph.sql but not applied.
-- ═══════════════════════════════════════════════════════════════════════════

-- Add ingredients as TEXT[] (AI agent sends string arrays)
ALTER TABLE dishes
    ADD COLUMN IF NOT EXISTS ingredients TEXT[] DEFAULT '{}'::text[];

-- Also ensure slug is nullable (safety)
ALTER TABLE dishes
    ALTER COLUMN slug DROP NOT NULL;
