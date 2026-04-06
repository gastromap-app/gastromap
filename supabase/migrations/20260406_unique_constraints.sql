-- Add UNIQUE constraints on dishes.name and ingredients.name
-- so DB itself rejects duplicates as a final safety net

ALTER TABLE dishes
    ADD CONSTRAINT dishes_name_unique UNIQUE (name);

ALTER TABLE ingredients
    ADD CONSTRAINT ingredients_name_unique UNIQUE (name);
