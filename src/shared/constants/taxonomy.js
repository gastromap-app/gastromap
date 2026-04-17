/**
 * Single source of truth for category, cuisine, price, label and visit-time
 * taxonomies used across Admin, AddPlace and Filter UIs.
 *
 * Historical duplication lived in:
 *   - src/features/dashboard/pages/AddPlacePage.jsx       (lowercase-id shape)
 *   - src/features/admin/components/LocationFormSlideOver (string-array shape)
 *   - src/features/dashboard/components/FilterModal       (Title-id shape)
 *
 * Any new surface should import from here. Ship shape adapters rather than
 * forking the list.
 */

// The canonical 11-item category list for admin/back-office forms.
export const CATEGORIES_FULL = [
    'Cafe', 'Restaurant', 'Street Food', 'Bar', 'Market',
    'Bakery', 'Winery', 'Store', 'Coffee Shop', 'Pastry Shop', 'Fine Dining',
]

// Compact public-facing subset used by the Suggest-a-Place wizard.
export const CATEGORIES_PUBLIC = [
    { id: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
    { id: 'cafe',       label: 'Café',       emoji: '☕' },
    { id: 'bar',        label: 'Bar',        emoji: '🍺' },
    { id: 'bakery',     label: 'Bakery',     emoji: '🥐' },
    { id: 'other',      label: 'Other',      emoji: '📍' },
]

export const PRICE_LEVELS = [
    { value: '$',    label: '$ — бюджетно' },
    { value: '$$',   label: '$$ — средне' },
    { value: '$$$',  label: '$$$ — дорого' },
    { value: '$$$$', label: '$$$$ — люкс' },
]

export const CUISINE_OPTIONS = [
    'Polish', 'Italian', 'Japanese', 'French', 'Mexican', 'Thai', 'Greek',
    'Georgian', 'Ukrainian', 'Spanish', 'Indian', 'Vietnamese', 'American',
    'Mediterranean', 'Israeli', 'Turkish', 'Chinese', 'Korean', 'Fusion',
]

export const LABEL_GROUPS = {
    "Кухня и Меню": [
        "Авторская кухня", "Веганское меню", "Вкусные десерты", "Завтраки целый день",
        "Местные продукты", "Меню завтраков", "Меню ланча", "Фьюжен",
        "Итальянская", "Французская", "Японская", "Китайская", "Греческая",
        "Испанская", "Мексиканская", "Тайская", "Грузинская", "Польская",
        "Израильская", "Американская", "Средиземноморская", "Индийская", "Вьетнамская",
    ].sort(),
    "Бар и Напитки": [
        "Авторские коктейли", "Винная карта", "Гостевые смены", "Дегустация вин",
        "DJ сеты", "Крафтовое пиво", "Спешиалти кофе", "Широкий выбор джина",
    ].sort(),
    "Атмосфера": [
        "Живописный вид", "Живая музыка", "Коворкинг", "Настольные игры",
        "Романтическая атмосфера", "Скрытый вход (Speakeasy)",
        "Счастливые часы", "Тихая атмосфера", "Уютно", "Оживлённая атмосфера",
    ].sort(),
    "Удобства и Сервис": [
        "Балкончики", "Детская игровая зона", "Доставка", "Инклюзивность",
        "Любимое у местных", "Парковка", "Pet friendly",
        "Самовывоз", "Терраса во дворе", "Терраса на крыше", "WiFi",
    ].sort(),
    "Награды": ["Гид Мишлен", "Звезда Мишлен", "Кальян", "Поздний ужин"].sort(),
}

export const VISIT_TIMES = [
    { id: 'morning',    label: 'Утро',  emoji: '🌅' },
    { id: 'day',        label: 'День',  emoji: '☀️' },
    { id: 'evening',    label: 'Вечер', emoji: '🌆' },
    { id: 'late_night', label: 'Ночь',  emoji: '🌙' },
]
