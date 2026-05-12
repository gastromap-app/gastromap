# План реализации: Исправление светлой темы GastroMap

## Обзор

Систематическое исправление светлой темы во всём приложении. Начинаем с инфраструктуры (tailwind.config.js + CSS-переменные), затем исправляем компоненты по приоритету использования, заканчиваем LandingPageV3 и финальной проверкой.

## Задачи

- [x] 1. Исправить инфраструктуру: tailwind.config.js и CSS-переменные surface
  - [x] 1.1 Добавить CSS-переменные `--surface`, `--surface-elevated`, `--surface-foreground` в `:root` и `[data-theme='dark']` секции файла `src/index.css`
    - В `:root`: `--surface: 0 0% 100%;` `--surface-elevated: 0 0% 98%;` `--surface-foreground: 240 10% 3.9%;`
    - В `[data-theme='dark']`: `--surface: 220 20% 6%;` `--surface-elevated: 220 20% 9%;` `--surface-foreground: 220 20% 96%;`
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Обновить `tailwind.config.js` — заменить hardcoded surface цвета на CSS-переменные
    - `surface.DEFAULT`: `'hsl(220 20% 6%)'` → `'hsl(var(--surface))'`
    - `surface.elevated`: `'hsl(220 20% 9%)'` → `'hsl(var(--surface-elevated))'`
    - `surface.foreground`: `'hsl(220 20% 96%)'` → `'hsl(var(--surface-foreground))'`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Исправить ProfileEditPage — чипы и теги
  - [x] 2.1 Исправить inactive state для Vibe Tags чипов
    - Заменить `'bg-white/5 text-white/40 border-white/10 hover:border-white/20'` на isDark тернарный: dark → текущие стили, light → `'bg-gray-100 text-gray-600 border-gray-200 hover:border-gray-300'`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 2.2 Исправить inactive state для Dietary & Allergens чипов
    - Аналогичная замена: добавить isDark условие с light-mode альтернативой
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 2.3 Исправить inactive state для Price Range кнопок
    - Заменить `'bg-white/5 text-white/40 border-white/10'` на isDark тернарный
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 2.4 Исправить inactive state для Features чипов
    - Аналогичная замена с isDark условием
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Исправить FilterModal и SmartSearchBar
  - [x] 3.1 Исправить FilterModal — filter chips inactive state
    - Найти все hardcoded dark стили в чипах фильтров, добавить isDark условие
    - _Requirements: 4.1, 4.2, 4.5_
  - [x] 3.2 Исправить FilterModal — action buttons
    - Проверить и исправить кнопки "Apply", "Reset" для light mode
    - _Requirements: 4.2, 4.5_
  - [x] 3.3 Исправить SmartSearchBar — фон и placeholder
    - Заменить hardcoded dark фон на isDark тернарный
    - Обеспечить видимый placeholder в light mode
    - _Requirements: 4.3, 4.4, 4.5_

- [x] 4. Checkpoint — проверить базовую функциональность
  - Ensure all tests pass, ask the user if questions arise.
  - Визуально проверить ProfileEditPage, FilterModal, SmartSearchBar в обеих темах

- [x] 5. Исправить страницы дашборда (часть 1)
  - [x] 5.1 Исправить DashboardPageV2
    - Найти все элементы с hardcoded dark стилями, добавить isDark условия
    - _Requirements: 3.3_
  - [x] 5.2 Исправить SavedPage
    - Исправить карточки и текст — добавить light-mode альтернативы
    - _Requirements: 3.2_
  - [x] 5.3 Исправить LeaderboardPage
    - Исправить границы и фоны для light mode
    - _Requirements: 3.4_
  - [x] 5.4 Исправить ProfilePage
    - Исправить статистику и теги для light mode
    - _Requirements: 3.8_

- [x] 6. Исправить страницы дашборда (часть 2)
  - [x] 6.1 Исправить HelpCenterPage
    - Исправить кнопки и текст для light mode
    - _Requirements: 3.5_
  - [x] 6.2 Исправить DeleteDataPage
    - Исправить карточки и кнопки для light mode
    - _Requirements: 3.6_
  - [x] 6.3 Исправить LanguageSettingsPage
    - Исправить элементы списка для light mode
    - _Requirements: 3.7_
  - [x] 6.4 Проверить SecurityPrivacyPage
    - Компонент уже использует isDark паттерн — проверить badge "Soon" (`bg-white/10 text-white/60`) и исправить если нужно
    - _Requirements: 3.1_

- [x] 7. Исправить LocationsPage
  - [x] 7.1 Исправить карточки локаций
    - Добавить isDark условия для фонов и границ карточек
    - _Requirements: 5.1_
  - [x] 7.2 Исправить текстовые элементы
    - Обеспечить достаточный контраст текста на светлом фоне
    - _Requirements: 5.2_
  - [x] 7.3 Исправить интерактивные элементы
    - Кнопки и ссылки должны быть видимы в light mode
    - _Requirements: 5.3_

- [x] 8. Checkpoint — проверить все dashboard страницы
  - Ensure all tests pass, ask the user if questions arise.
  - Проверить все исправленные страницы в обеих темах

- [x] 9. Исправить LandingPageV3
  - [x] 9.1 Добавить useTheme hook и isDark переменную в LandingPageV3
    - Импортировать useTheme, добавить `const { theme } = useTheme()` и `const isDark = theme === 'dark'`
    - Передать isDark как prop во все sub-компоненты (Navbar, HeroSection, AboutSection, и т.д.)
    - _Requirements: 6.4_
  - [x] 9.2 Исправить корневой контейнер и Navbar
    - Корневой div: `bg-[#0A0A0A] text-white` → isDark тернарный
    - Navbar scrolled state: `bg-black/80 border-white/5` → isDark тернарный
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 9.3 Исправить AboutSection и FeaturesSection
    - Заменить `bg-[#0A0A0A]` на isDark условие
    - Заменить `text-white`, `text-white/30`, `text-white/40`, `text-white/50` на isDark тернарные
    - _Requirements: 6.1, 6.2_
  - [x] 9.4 Исправить GallerySection, CitiesMarquee, StatsSection
    - Аналогичные замены фонов и текста
    - _Requirements: 6.1, 6.2_
  - [x] 9.5 Исправить ManifestoSection и Footer
    - Заменить hardcoded dark стили на isDark условия
    - Исправить кнопки и ссылки для light mode
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 10. Исправить MainLayout — кнопка AI-чата
  - [x] 10.1 Найти и исправить AI chat button
    - Заменить `bg-white/10` на isDark тернарный: dark → `bg-white/10`, light → `bg-gray-100` или `bg-blue-50`
    - Обеспечить видимость иконки в обоих режимах
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 11. Финальная проверка и accessibility audit
  - [x] 11.1 Проверить отсутствие unconditional dark-only стилей
    - Grep по всем исправленным файлам на паттерны `bg-white/`, `text-white/`, `border-white/` без isDark условия
    - _Requirements: 8.4, 9.2_
  - [x] 11.2 Проверить WCAG AA контрастность
    - Убедиться что все текстовые элементы в light mode имеют контраст >= 4.5:1
    - Убедиться что UI элементы имеют контраст >= 3:1
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 11.3 Проверить отсутствие визуальных регрессий в dark mode
    - Убедиться что тёмная тема не сломана после всех изменений
    - _Requirements: 9.3_

- [x] 12. Final checkpoint — все исправления завершены
  - Ensure all tests pass, ask the user if questions arise.
  - Полная проверка приложения в обеих темах

## Заметки

- Все исправления используют существующий isDark паттерн — новая инфраструктура не вводится
- SecurityPrivacyPage уже корректно использует isDark — требуется только проверка badge
- LandingPageV3 — самый объёмный компонент, требует передачи isDark через props в sub-компоненты
- Стандартные замены: `bg-white/5` → `bg-gray-100`, `text-white/40` → `text-gray-600`, `border-white/10` → `border-gray-200`
- Checkpoints позволяют проверять прогресс инкрементально
