-- ═══════════════════════════════════════════════════════════════════════════
-- SMART SCHEMA — RPC функции для auto-migration из api/kg/save.js
-- Date: 2026-04-06
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. get_table_columns(p_table) — возвращает колонки таблицы с типами
--    Вызывается из save.js для проверки существующей схемы
CREATE OR REPLACE FUNCTION get_table_columns(p_table TEXT)
RETURNS TABLE (column_name TEXT, data_type TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT
        c.column_name::TEXT,
        c.data_type::TEXT
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name   = p_table
    ORDER BY c.ordinal_position;
$$;

-- 2. exec_sql(query) — выполняет произвольный SQL (только ALTER TABLE ADD COLUMN)
--    SECURITY DEFINER — запускается с правами владельца (postgres/service_role)
--    Ограничен паттерном ALTER TABLE ... ADD COLUMN для безопасности
CREATE OR REPLACE FUNCTION exec_sql(query TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Разрешаем только ADD COLUMN операции (защита от произвольного SQL)
    IF query !~* '^\s*ALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN' THEN
        RAISE EXCEPTION 'exec_sql: only ALTER TABLE ADD COLUMN is allowed. Got: %', LEFT(query, 80);
    END IF;

    EXECUTE query;
EXCEPTION
    WHEN duplicate_column THEN
        -- Колонка уже существует — игнорируем
        NULL;
    WHEN OTHERS THEN
        RAISE WARNING 'exec_sql error: % — query: %', SQLERRM, LEFT(query, 80);
END;
$$;

-- Права: только service_role может вызывать эти функции
REVOKE ALL ON FUNCTION get_table_columns(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_table_columns(TEXT) TO service_role;

REVOKE ALL ON FUNCTION exec_sql(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;
