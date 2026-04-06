# KG Admin & AI Integration Finalization

Оптимизация панели управления Knowledge Graph, исправление ошибок в работе AI и предотвращение дубликатов.

## Phase 1: API Key & Configuration Fixes
- [ ] Исправить `src/shared/api/ai.api.js`: Проверить корректность `getActiveAIConfig`.
- [ ] Исправить `src/shared/api/translation.api.js`: Обновить проверку `isOpenRouterConfigured`.
- [ ] Убедиться, что `useProxy` в `ai.api.js` учитывает наличие ключа в UI store.
- [ ] Проверить все обращения к `config.ai.openRouterKey` на опечатки.

## Phase 2: Deduplication Logic
- [ ] Улучшить `norm()` в `src/shared/api/kg-ai-agent.api.js` для более агрессивной очистки.
- [ ] Внедрить проверку на дубликаты по базе данных (fuzzy search или точное совпадение имен).
- [ ] Добавить в UI предупреждение, если сущность уже существует в базе.

## Phase 3: KG Merge Tool
- [ ] Создать API эндпоинт/функцию `mergeEntities` в `knowledge-graph.api.js`.
- [ ] Добавить интерфейс слияния сущностей в `AdminKnowledgeGraphPage.jsx`.

## Phase 4: UI Standardization (Indigo/Blue)
- [ ] Пройти по всем страницам админки и заменить `purple/violet` на `indigo/blue`.
- [ ] Проверить все hover состояния и градиенты.

## Verification
- [ ] Тест подключения AI ключа.
- [ ] Попытка создать дубликат "Pasta" при наличии "Italian Pasta".
- [ ] Слияние двух тестовых сущностей.
