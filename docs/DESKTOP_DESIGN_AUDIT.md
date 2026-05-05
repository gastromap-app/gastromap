# Дизайн-аудит Desktop-версии GastroMap V2

**Дата:** Май 2026  
**URL:** https://gastromap-five.vercel.app  
**Фокус:** Пользовательская часть (публичные страницы + авторизованный dashboard)

---

## КРИТИЧЕСКИЕ ПРОБЛЕМЫ (Blocker)

### 1. Отсутствует desktop-навигация для авторизованных пользователей

**Где:** `MainLayout.jsx`, `BottomNav.jsx` (line 31: `md:hidden`)

**Проблема:** BottomNav полностью скрыт на desktop (`md:hidden`). UniversalHeader содержит только:
- Логотип (→ /dashboard)
- Кнопку "Add Place"
- Аватар профиля
- Тоггл темы / языка / logout

**Чего не хватает:** Нет способа попасть на `/map`, `/saved`, `/visited`, `/ai-guide`, `/explore`, `/dashboard/leaderboard` с desktop — только через URL вручную.

**Влияние:** Desktop-пользователи не могут пользоваться 60% функционала приложения без ручного ввода адресов.

---

## ВЫСОКИЕ ПРОБЛЕМЫ (Major)

### 2. PublicNavbar растягивается на всю ширину экрана

**Где:** `PublicNavbar.jsx` (line 33)

**Проблема:** Плавающая пилюля навигации использует `w-full` без `max-w-7xl mx-auto`. На экранах 1440px+ выглядит как «полоска» на всю ширину — теряется премиальный вид.

**Ожидаемо:** Центрированная пилюля с `max-w-7xl` (1280px) как на других современных сайтах.

### 3. MainLayout: конфликт padding'ов

**Где:** `MainLayout.jsx` (lines 31–32)

**Проблема:**
```jsx
className={`... ${isFullScreen ? '' : 'pb-24'} md:pb-0`}
style={!isFullScreen ? { paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' } : undefined}
```

Tailwind `md:pb-0` пытается убрать padding, но inline `style` перезаписывает его на мобильных. На desktop — `md:pb-0` работает, но контент прилипает к низу без desktop-навигации.

---

## СРЕДНИЕ ПРОБЛЕМЫ (Minor)

### 4. DashboardPage — нужна проверка desktop-сетки

**Где:** `DashboardPage.jsx`

**Проблема:** Страница ~700 строк, преимущественно mobile-first. Нужно проверить, что location cards, country grid, nearby section корректно адаптируются на desktop (lg:grid-cols-3+).

### 5. Explore-страницы — CitiesPage / LocationsPage

**Где:** `CitiesPage.jsx`, `LocationsPage.jsx`

**Проблема:** CountriesPage уже имеет `hidden md:block` desktop-версию. Нужно проверить, что CitiesPage и LocationsPage также имеют desktop-раскладку, а не только mobile-стек.

### 6. LocationDetailsPage — 68.5KB

**Где:** `LocationDetailsPage.jsx`

**Проблема:** Очень большая страница, вероятно mobile-first. Нужно проверить desktop-раскладку (двухколоночная: фото+инфо слева, карта+рекомендации справа).

---

## РЕКОМЕНДАЦИИ ПО ИСПРАВЛЕНИЮ

### Приоритет 1: Desktop Sidebar Navigation

Создать `DesktopSidebar.jsx` — компактный боковой бар (~64px wide, иконки + tooltip) с пунктами:
- Dashboard
- Map
- AI Guide
- Saved
- Visited
- Explore
- Leaderboard
- Profile

Интегрировать в `MainLayout`: на desktop (`md:flex`) показывать sidebar слева, контент справа. На mobile — оставить BottomNav.

### Приоритет 2: Fix PublicNavbar max-width

Добавить `max-w-7xl mx-auto` к контейнеру пилюли в `PublicNavbar.jsx`.

### Приоритет 3: Fix MainLayout padding

Убрать конфликт между Tailwind `md:pb-0` и inline style. Использовать условный рендеринг или media query.

### Приоритет 4: Review Explore pages

Проверить `CitiesPage.jsx` и `LocationsPage.jsx` на наличие `hidden md:block` desktop-версии. Если нет — добавить.

---

## ИТОГО

| Проблема | Приоритет | Статус |
|---|---|---|
| Нет desktop-навигации | Blocker | 🔴 |
| PublicNavbar width | Major | 🟠 |
| MainLayout padding conflict | Major | 🟠 |
| DashboardPage desktop grid | Minor | 🟡 |
| Cities/Locations desktop | Minor | 🟡 |
| LocationDetailsPage desktop | Minor | 🟡 |
