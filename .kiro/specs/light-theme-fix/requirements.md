# Документ требований: Исправление светлой темы GastroMap

## Введение

Приложение GastroMap было разработано с приоритетом тёмной темы. Множество компонентов используют жёстко закодированные цвета тёмного режима (bg-white/5, text-white/40, border-white/10 и т.д.), которые становятся невидимыми или нечитаемыми в светлом режиме. Система CSS-переменных в index.css корректно настроена для обеих тем, но компоненты не используют её последовательно. Данная спецификация описывает требования к полному исправлению светлой темы во всём приложении.

## Глоссарий

- **Theme_System**: Система переключения тем, включающая CSS-переменные в index.css, атрибут `data-theme` на элементе `<html>`, класс `dark`, хук `useTheme()` и утилиты Tailwind
- **Component**: React-компонент приложения GastroMap (страница, модальное окно, элемент UI)
- **isDark_Pattern**: Паттерн условного применения стилей через `const isDark = theme === 'dark'` с тернарным оператором для выбора классов
- **Hardcoded_Dark_Style**: CSS-класс, предназначенный только для тёмной темы (например, `bg-white/5`, `text-white/40`, `border-white/10`), применённый без условия темы
- **Semantic_Color**: CSS-переменная или утилита Tailwind, автоматически адаптирующаяся к текущей теме (например, `bg-background`, `text-foreground`, `.text-t-primary`)
- **Surface_Utility**: CSS-утилита `.surface` или `.surface-elevated`, определённая в index.css с вариантами для обеих тем
- **WCAG_AA**: Стандарт доступности, требующий контрастность 4.5:1 для обычного текста и 3:1 для крупного текста и UI-элементов
- **Tailwind_Config**: Файл tailwind.config.js, содержащий определения цветов, включая `surface` цвета

## Требования

### Требование 1: Исправление конфигурации Tailwind — цвета surface

**User Story:** Как разработчик, я хочу, чтобы цвета `surface` в tailwind.config.js использовали CSS-переменные вместо жёстко закодированных значений, чтобы они автоматически адаптировались к текущей теме.

#### Критерии приёмки

1. THE Tailwind_Config SHALL define `surface.DEFAULT` color using a CSS variable that responds to the active theme
2. THE Tailwind_Config SHALL define `surface.elevated` color using a CSS variable that responds to the active theme
3. THE Tailwind_Config SHALL define `surface.foreground` color using a CSS variable that responds to the active theme
4. WHEN the light theme is active, THE Theme_System SHALL render surface colors as light values (white or near-white backgrounds)
5. WHEN the dark theme is active, THE Theme_System SHALL render surface colors as dark values (hsl(220 20% 6%) and hsl(220 20% 9%))

### Требование 2: Исправление ProfileEditPage — чипы и теги

**User Story:** Как пользователь в светлом режиме, я хочу видеть все чипы и кнопки-теги на странице редактирования профиля с читаемым текстом и видимыми границами, чтобы я мог взаимодействовать с элементами выбора предпочтений.

#### Критерии приёмки

1. WHEN the light theme is active, THE Component (ProfileEditPage) SHALL render inactive chip/tag buttons with visible text, background, and border appropriate for light backgrounds
2. WHEN the dark theme is active, THE Component (ProfileEditPage) SHALL render inactive chip/tag buttons with the existing dark-mode styling (bg-white/5, text-white/40, border-white/10)
3. THE Component (ProfileEditPage) SHALL use the isDark_Pattern to conditionally apply theme-appropriate styles to all Vibe, Dietary, Price, and Features chip buttons
4. WHEN a chip is in inactive state in light mode, THE Component (ProfileEditPage) SHALL display text with a minimum contrast ratio of 4.5:1 against its background

### Требование 3: Исправление страниц дашборда

**User Story:** Как пользователь в светлом режиме, я хочу, чтобы все страницы дашборда (SecurityPrivacyPage, SavedPage, DashboardPageV2, LeaderboardPage, HelpCenterPage, DeleteDataPage, LanguageSettingsPage, ProfilePage) отображались с корректными цветами для светлой темы.

#### Критерии приёмки

1. WHEN the light theme is active, THE Component (SecurityPrivacyPage) SHALL render badges, toggles, and interactive elements with light-theme-appropriate colors
2. WHEN the light theme is active, THE Component (SavedPage) SHALL render cards and text with light-theme-appropriate colors and visible borders
3. WHEN the light theme is active, THE Component (DashboardPageV2) SHALL render all UI elements with light-theme-appropriate colors
4. WHEN the light theme is active, THE Component (LeaderboardPage) SHALL render borders and backgrounds with light-theme-appropriate colors
5. WHEN the light theme is active, THE Component (HelpCenterPage) SHALL render buttons and text with light-theme-appropriate colors
6. WHEN the light theme is active, THE Component (DeleteDataPage) SHALL render cards and buttons with light-theme-appropriate colors
7. WHEN the light theme is active, THE Component (LanguageSettingsPage) SHALL render list items with light-theme-appropriate colors
8. WHEN the light theme is active, THE Component (ProfilePage) SHALL render stats and tags with light-theme-appropriate colors
9. FOR ALL dashboard components listed above, THE Component SHALL use either the isDark_Pattern or Semantic_Color utilities to ensure theme responsiveness

### Требование 4: Исправление FilterModal и SmartSearchBar

**User Story:** Как пользователь в светлом режиме, я хочу, чтобы модальное окно фильтров и панель поиска отображались с читаемым текстом и видимыми элементами управления, чтобы я мог эффективно искать и фильтровать рестораны.

#### Критерии приёмки

1. WHEN the light theme is active, THE Component (FilterModal) SHALL render filter chips with visible text, backgrounds, and borders appropriate for light mode
2. WHEN the light theme is active, THE Component (FilterModal) SHALL render action buttons with light-theme-appropriate styling
3. WHEN the light theme is active, THE Component (SmartSearchBar) SHALL render the search input with a visible background and placeholder text with sufficient contrast
4. WHEN the light theme is active, THE Component (SmartSearchBar) SHALL render suggestion items with light-theme-appropriate colors
5. FOR ALL interactive elements in FilterModal and SmartSearchBar, THE Component SHALL maintain a minimum contrast ratio of 3:1 for UI elements against their backgrounds in light mode

### Требование 5: Исправление LocationsPage

**User Story:** Как пользователь в светлом режиме, я хочу, чтобы страница локаций отображала карточки, текст и границы с корректными цветами, чтобы контент был читаемым и визуально структурированным.

#### Критерии приёмки

1. WHEN the light theme is active, THE Component (LocationsPage) SHALL render location cards with light-theme-appropriate backgrounds and visible borders
2. WHEN the light theme is active, THE Component (LocationsPage) SHALL render all text elements with sufficient contrast against light backgrounds
3. WHEN the light theme is active, THE Component (LocationsPage) SHALL render interactive elements (buttons, links) with visible styling

### Требование 6: Исправление LandingPageV3

**User Story:** Как посетитель сайта в светлом режиме, я хочу, чтобы лендинг-страница адаптировалась к моей системной теме или выбранной теме, вместо того чтобы всегда отображаться с тёмным фоном.

#### Критерии приёмки

1. WHEN the light theme is active, THE Component (LandingPageV3) SHALL render with a light background instead of the hardcoded dark background
2. WHEN the light theme is active, THE Component (LandingPageV3) SHALL render all text with colors appropriate for light backgrounds
3. WHEN the dark theme is active, THE Component (LandingPageV3) SHALL maintain its current dark aesthetic
4. THE Component (LandingPageV3) SHALL use the isDark_Pattern or Semantic_Color utilities for all background and text color declarations

### Требование 7: Исправление MainLayout — кнопка AI-чата

**User Story:** Как пользователь в светлом режиме, я хочу, чтобы кнопка AI-чата была видимой и стилистически согласованной с остальным интерфейсом.

#### Критерии приёмки

1. WHEN the light theme is active, THE Component (MainLayout) SHALL render the AI chat button with a visible background that contrasts with the page background
2. WHEN the light theme is active, THE Component (MainLayout) SHALL render the AI chat button icon with sufficient contrast (minimum 3:1) against the button background
3. THE Component (MainLayout) SHALL use the isDark_Pattern to conditionally apply theme-appropriate styles to the AI chat button

### Требование 8: Соответствие стандартам доступности WCAG AA

**User Story:** Как пользователь с ограниченными возможностями зрения, я хочу, чтобы все текстовые элементы и элементы управления в светлом режиме имели достаточный контраст, чтобы я мог комфортно пользоваться приложением.

#### Критерии приёмки

1. FOR ALL text elements in light mode, THE Theme_System SHALL ensure a minimum contrast ratio of 4.5:1 between text color and its background
2. FOR ALL UI interactive elements (buttons, inputs, icons) in light mode, THE Theme_System SHALL ensure a minimum contrast ratio of 3:1 against adjacent colors
3. FOR ALL border elements that convey meaning in light mode, THE Theme_System SHALL ensure borders are visually distinguishable from their surrounding backgrounds
4. IF a component uses opacity-based colors (e.g., text-white/40) without theme conditioning, THEN THE Component SHALL be refactored to use theme-conditional styling

### Требование 9: Сохранение существующей архитектуры тем

**User Story:** Как разработчик, я хочу, чтобы все исправления использовали существующую инфраструктуру тем (isDark паттерн, CSS-переменные, Tailwind dark: префикс) без введения новых механизмов, чтобы кодовая база оставалась консистентной.

#### Критерии приёмки

1. THE Theme_System SHALL NOT introduce new theming mechanisms, libraries, or patterns beyond what already exists in the codebase
2. FOR ALL theme fixes, THE Component SHALL use one of the following approaches: isDark_Pattern with ternary operator, Tailwind `dark:` prefix, or Semantic_Color CSS utilities
3. WHEN fixing a component, THE Component SHALL preserve the existing dark-mode appearance without visual regression
4. THE Theme_System SHALL continue to use the `data-theme` attribute on the HTML element and the `dark` class for theme switching
