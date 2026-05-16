# 📋 Gastromap V2: Статус Разработки и Журнал Изменений

## 🚀 Текущий Этап: Стадия 1 — Фундамент и Дизайн (In Progress)
Приложение переведено на модульную архитектуру. Основной упор на дизайн и компоненты админки. Бэкенд (Supabase) в планах.

---

## ✅ Журнал изменений (Лог)

### [2026-05-16] — Data Loading Architecture Complete + AI Pipeline Fix

**Architecture (BREAKING):**
- **useLocationsStore DELETED** — React Query is now the single source of truth for all server state
- **useLocationFilters()** — URL-driven filter state (survives refresh, shareable)
- **useSession()** — Single auth gate replacing multiple isAuthLoading checks
- **locationsRealtime.js** — Supabase Realtime → React Query cache sync
- **DataSection** wrapper — 8-second skeleton ceiling + error/retry UI
- Workaround timeouts removed (30s Promise.race, 3s getSession race, 3s rescue)

**AI Chat Pipeline:**
- Fixed: proxyUrl pointed to non-existent Supabase Edge Function (always 503)
- Fixed: Paid models now use _direct_model mode (skip cascade)
- Fixed: Admin cascade config (_cascade) now respected by server
- Fixed: Language reminder in XML-mode tool results (bot responds in user's language)
- Fixed: usedLocations uses tool results directly (not empty store lookup)
- Fixed: loadFromDB() awaited before reading admin maxTokens

**Notifications:**
- Fixed: markAllAsRead now sets both read:true AND unread:false (UI field mismatch)
- Fixed: Persists to Supabase via markAllNotificationsRead()
- Outside-click-to-close confirmed working

### [2026-02-01] — Архитектурный Рефакторинг и Импорт данных
**Архитектура и Масштабируемость:**
- **FSD-lite**: Проект переведен на модульную структуру.
    - Создана папка `src/app` как точка входа.
    - **AppRouter**: Все роуты вынесены в отдельный компонент `AppRouter.jsx`.
    - **AppProviders**: Все провайдеры (React Query, Router, SmoothScroll) изолированы в `AppProviders.jsx`.
- Удален монолитный `src/App.jsx`, теперь точка входа — `src/app/App.jsx`.
- Это позволяет легко изменять роутинг или добавлять новые провайдеры, не затрагивая всё приложение.

**Функционал Админки:**
- **ImportWizard**: Реализован продвинутый мастер импорта локаций.
    - Поддержка форматов **CSV** и **JSON**.
    - Предварительный просмотр данных перед импортом.
    - Опция **GastroAI Enrichment** для автоматического обогащения данных (подготовлено для интеграции с GMaps).
    - Анимированный UI с использованием `framer-motion`.
- Компонент интегрирован в страницу `AdminLocationsPage`.

### [2026-02-01] — Дизайн и Мобильная Оптимизация
**Развертывание и Инфраструктура:**
- Папка проекта переименована в `Gastromap_v2_skeleton`.
- Проект инициализирован как Git-репозиторий + установлен **AG-Kit**.
- Выполнен деплой на **Vercel**: [gastromap-v2-skeleton.vercel.app](https://gastromap-v2-skeleton.vercel.app).

**Дизайн и UI:**
- **Landing Page**: Полная адаптация под мобильные (Bento Grid, типографика, отступы).
- **Public Navbar**: Новый дизайн "парящей шапки" с эффектом Glassmorphism.
- **Dark Mode**: Комплексная оптимизация темной темы (палитра Slate, контрастность, Bento UI).
- **Public Footer**: Адаптивная сетка и улучшенная компоновка.

---

## 🏗 Текущая Архитектура (V2)
- **Framework**: React + Vite
- **Styling**: Tailwind CSS + DaisyUI
- **Structure**: Feature-Sliced Design (FSD-lite) — `src/app`, `src/features`, `src/components`.
- **Features**: `auth`, `public`, `dashboard`, `admin`.

---

## 📅 План на ближайшее время:
- [ ] Интеграция с Google Maps Platform MCP (через AG-Kit) для enrichment данных в ImportWizard.
- [ ] Создание интерфейса для просмотра "Географии" локаций в админке.
- [ ] Подготовка к миграции на Supabase (после финализации логики).

---
**Примечание:** Код на GitHub отправляется только по прямому указанию пользователя. Все локальные изменения сохраняются в `CHANGELOG.md` внутри проекта.
