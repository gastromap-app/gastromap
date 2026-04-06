# 🔧 План исправления: KG Cache Race Condition

**Файл:** `src/features/admin/pages/AdminKnowledgeGraphPage.jsx`  
**Дата:** 2026-04-06  
**Приоритет:** HIGH — из-за этих багов новые данные (например, "German") не появляются в списке после сохранения

---

## Баг #1: Race condition в кнопке ↺ Refresh

### Симптом
После нажатия ↺ список обновляется, но **показывает старые данные** — новые записи из Supabase не появляются.

### Корневая причина
```js
// ТЕКУЩИЙ КОД (строки ~964–974 AdminKnowledgeGraphPage.jsx)
onClick={() => {
    // ❌ ПРОБЛЕМА: import() — асинхронный! Промис не ждётся.
    // invalidateCacheGroup выполнится ПОЗЖЕ, чем removeQueries ниже.
    import('@/shared/lib/cache').then(({ invalidateCacheGroup }) => {
        invalidateCacheGroup('cuisines')
        invalidateCacheGroup('dishes')
        invalidateCacheGroup('ingredients')
    })
    // Эти строки выполняются СИНХРОННО — сразу после вызова import()
    queryClient.removeQueries({ queryKey: ['knowledge-cuisines'] })
    queryClient.removeQueries({ queryKey: ['knowledge-dishes'] })
    queryClient.removeQueries({ queryKey: ['knowledge-ingredients'] })
    // setTimeout 100ms — НО localStorage ещё не очищен!
    // getCuisines() читает getChachedData() → видит старый кэш → возвращает его
    setTimeout(() => { refetchCuisines(); refetchDishes(); refetchIngredients() }, 100)
}}
```

**Порядок выполнения:**
1. `import()` — запускается, уходит в event loop
2. `queryClient.removeQueries()` — выполняется синхронно
3. `setTimeout(refetch, 100ms)` — планируется
4. *(через ~1ms)* `invalidateCacheGroup` — наконец выполняется
5. *(через ~100ms)* `refetchCuisines()` — вызывается **ДО** очистки L2 кэша
6. `getCuisines()` → `getCachedData('cuisines')` → **HIT** → возвращает старый кэш!

### Решение

Сделать кнопку `async` и дождаться `invalidateCacheGroup` **перед** рефетчем:

```js
// ✅ ИСПРАВЛЕННЫЙ КОД
onClick={async () => {
    // 1. Синхронно импортируем (уже загружен в бандле — await мгновенный)
    const { invalidateCacheGroup } = await import('@/shared/lib/cache')

    // 2. Сначала чистим L2 (localStorage)
    invalidateCacheGroup('cuisines')
    invalidateCacheGroup('dishes')
    invalidateCacheGroup('ingredients')

    // 3. Потом чистим L1 (React Query in-memory)
    queryClient.removeQueries({ queryKey: ['knowledge-cuisines'] })
    queryClient.removeQueries({ queryKey: ['knowledge-dishes'] })
    queryClient.removeQueries({ queryKey: ['knowledge-ingredients'] })
    queryClient.removeQueries({ queryKey: ['knowledge-stats'] })

    // 4. Теперь рефетч — getCuisines() не найдёт кэш и пойдёт в Supabase
    await Promise.all([refetchCuisines(), refetchDishes(), refetchIngredients()])
}}
```

**Ключевые изменения:**
- `onClick` стал `async`
- `import()` заменён на `await import()` — гарантируем порядок
- `setTimeout(100ms)` убран — `await Promise.all()` ждёт реального завершения запросов
- Добавлен `removeQueries(['knowledge-stats'])` для консистентности

---

## Баг #2: `handleAgentSave` + `handleBatchComplete` не чистят L2 кэш перед рефетчем

### Симптом
После batch-сохранения через AI агент (кнопка "Save All") — список **не обновляется** или обновляется только после ручного ↺.

### Корневая причина

`handleBatchComplete` (строки ~693–709) чистит localStorage **через `invalidateCacheGroup`** — это правильно. Но проблема в `setTimeout(300ms)`:

```js
// ТЕКУЩИЙ КОД
const handleBatchComplete = (savedCount, errors) => {
    // L2: чистим localStorage
    invalidateCacheGroup('cuisines')       // ✅ синхронно
    invalidateCacheGroup('dishes')         // ✅ синхронно
    invalidateCacheGroup('ingredients')    // ✅ синхронно

    // L1: чистим React Query
    queryClient.removeQueries({ queryKey: ['knowledge-cuisines'] })
    queryClient.removeQueries({ queryKey: ['knowledge-dishes'] })
    queryClient.removeQueries({ queryKey: ['knowledge-ingredients'] })
    queryClient.removeQueries({ queryKey: ['knowledge-stats'] })

    // ❌ ПРОБЛЕМА: setTimeout(300ms) — React Query может начать
    // background-refetch раньше (staleTime: 30s истёк), и в этом
    // 300ms окне getCuisines() пройдёт через cache miss, уйдёт в
    // Supabase — но React Query уже держит stale данные в памяти
    // и вернёт их из gcTime кэша минуя queryFn
    setTimeout(() => {
        refetchCuisines()
        refetchDishes()
        refetchIngredients()
    }, 300)
}
```

**Вторая точка отказа:** `handleAgentSave` (строка ~670) — сейчас не вызывает рефетч совсем:
```js
// Комментарий говорит "handleBatchComplete сделает это"
// Это правильно — но только если handleBatchComplete вызывается.
// Если AI агент сохраняет 1 запись и это не batch — onBatchComplete может не вызваться.
```

Нужно убедиться что `onBatchComplete` вызывается даже при `savedCount = 0` (все дубли).

### Решение

```js
// ✅ ИСПРАВЛЕННЫЙ handleBatchComplete
const handleBatchComplete = useCallback(async (savedCount, errors) => {
    // 1. Синхронно чистим L2
    invalidateCacheGroup('cuisines')
    invalidateCacheGroup('dishes')
    invalidateCacheGroup('ingredients')

    // 2. Чистим L1 — removeQueries сбрасывает данные из памяти полностью
    queryClient.removeQueries({ queryKey: ['knowledge-cuisines'] })
    queryClient.removeQueries({ queryKey: ['knowledge-dishes'] })
    queryClient.removeQueries({ queryKey: ['knowledge-ingredients'] })
    queryClient.removeQueries({ queryKey: ['knowledge-stats'] })

    // 3. Немедленный refetch (без setTimeout) — кэши уже чисты
    // Используем Promise.all чтобы не блокировать UI на каждом по очереди
    try {
        await Promise.all([refetchCuisines(), refetchDishes(), refetchIngredients()])
    } catch {
        // refetch failure — non-critical, user can click ↺
    }

    // 4. Toast только если что-то реально сохранилось
    if (savedCount > 0) {
        showToast(`Saved ${savedCount} items`, 'success')
    }
    if (errors?.length > 0) {
        showToast(`${errors.length} errors during save`, 'error')
    }
}, [queryClient, refetchCuisines, refetchDishes, refetchIngredients])
```

**Ключевые изменения:**
- Убран `setTimeout(300ms)` → `await Promise.all()`
- `handleBatchComplete` стал `async` + обёрнут в `useCallback`
- Добавлен `try/catch` вокруг рефетча (сеть может упасть — не блокируем UI)
- Toast перенесён сюда из KGAgent компонента для единого управления

---

## Дополнительно: Баг #3 (связанный) — `useUpdateCuisineMutation` неверная сигнатура

### Симптом
KG Enrichment агент обогащает кухни (origin_country, flavor_profile и т.д.) — но данные **не сохраняются**.

### Причина
```js
// queries.js — мутация ожидает { id, updates }
mutationFn: ({ id, updates }) => updateCuisine(id, updates)

// AdminKnowledgeGraphPage.jsx:679 — передаётся { id, ...fields }
await updateCuisineMutation.mutateAsync({ id, ...updates })
// Это означает: { id: 'abc', origin_country: 'Germany', flavor_profile: 'hearty' }
// updates будет undefined → updateCuisine('abc', undefined) → UPDATE SET updated_at = NOW()
```

### Решение — два варианта:

**Вариант A (меняем вызов, не трогаем мутацию):**
```js
// AdminKnowledgeGraphPage.jsx
const handleCuisineEnriched = useCallback(async (id, updates) => {
    // ✅ Передаём в правильном формате { id, updates }
    await updateCuisineMutation.mutateAsync({ id, updates })
    // onSuccess в мутации уже вызывает invalidateQueries — кэш почистится автоматически
}, [updateCuisineMutation])
```

**Вариант B (меняем мутацию, не трогаем вызов):**
```js
// queries.js
mutationFn: ({ id, updates, ...rest }) => {
    // Если updates явно передан — используем его, иначе берём rest (spread полей)
    return updateCuisine(id, updates ?? rest)
}
```

**Рекомендуется Вариант A** — явная сигнатура, меньше неожиданностей.

---

## Файлы для изменения

| Файл | Строки | Изменение |
|------|--------|-----------|
| `src/features/admin/pages/AdminKnowledgeGraphPage.jsx` | ~964–974 | Кнопка ↺: async + await import() + убрать setTimeout |
| `src/features/admin/pages/AdminKnowledgeGraphPage.jsx` | ~693–709 | handleBatchComplete: async + Promise.all + убрать setTimeout |
| `src/features/admin/pages/AdminKnowledgeGraphPage.jsx` | ~679 | handleCuisineEnriched: `{ id, updates }` вместо `{ id, ...updates }` |

---

## Тест после исправления

1. Открыть `/admin/kg` → вкладка Cuisines
2. Открыть DevTools → Application → localStorage → найти `gm_cache_cuisines`
3. Нажать ↺ Refresh
4. **Ожидаемо:** `gm_cache_cuisines` исчезает из localStorage, потом появляется заново с актуальными данными
5. В Network tab: должен появиться запрос `GET /rest/v1/cuisines?...` — значит кэш был сброшен корректно
6. "German" должен появиться в списке ✅
