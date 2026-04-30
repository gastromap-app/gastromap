/**
 * filterOptions.js — ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ для всех фильтров GastroMap.
 *
 * Это единственное место, где нужно добавлять:
 *   - новые типы заведений (ESTABLISHMENT_TYPES)
 *   - новые кухни / атмосферу / удобства (LABEL_GROUPS)
 *   - время визита (BEST_TIMES)
 *
 * Изменения здесь автоматически отражаются в:
 *   1. FilterModal    — фильтры для пользователей
 *   2. AdminLocationsPage — форма редактирования локации
 *
 * HOW TO ADD A NEW CUISINE:
 *   Просто добавьте строку в LABEL_GROUPS["Cuisine & Menu"].items
 *   → Она автоматически появится в фильтрах и карточке локации.
 *
 * HOW TO ADD A NEW ESTABLISHMENT TYPE:
 *   Добавьте объект { id, label, icon } в ESTABLISHMENT_TYPES
 *   → Появится в блоке "Establishment Type" фильтра и в select карточки.
 */

// ─── Типы заведений ─────────────────────────────────────────────────────────
// id    — значение, которое хранится в БД (поле category)
// label — что показывается пользователю
// icon  — эмодзи для кнопки фильтра
export const ESTABLISHMENT_TYPES = [
    { id: 'all',         label: 'All',        labelRu: 'Все',          icon: '🌎' },
    { id: 'Cafe',        label: 'Cafe',       labelRu: 'Кафе',         icon: '☕' },
    { id: 'Restaurant',  label: 'Restaurant', labelRu: 'Ресторан',     icon: '🍽️' },
    { id: 'Street Food', label: 'Street',     labelRu: 'Стритфуд',     icon: '🍕' },
    { id: 'Bar',         label: 'Bar',        labelRu: 'Бар',          icon: '🍸' },
    { id: 'Restobar',    label: 'Restobar',   labelRu: 'Рестобар',     icon: '🍹' },
    { id: 'Market',      label: 'Market',     labelRu: 'Маркет',       icon: '🛒' },
    { id: 'Bakery',      label: 'Bakery',     labelRu: 'Пекарня',      icon: '🥐' },
    { id: 'Winery',      label: 'Winery',     labelRu: 'Винодельня',   icon: '🍷' },
    { id: 'Wine Bar',    label: 'Wine Bar',   labelRu: 'Винный бар',   icon: '🍷' },
    { id: 'Coffee',      label: 'Coffee',     labelRu: 'Кофе',         icon: '☕' },
    { id: 'Pastry',      label: 'Pastry',     labelRu: 'Кондитерская', icon: '🍰' },
    { id: 'Fine Dining', label: 'Fine Dining',labelRu: 'Fine Dining',  icon: '🎩' },
]

// Canonical establishment type names for data validation (lowercased for comparison)
// Includes common variants, translations, and synonyms that might appear in cuisine fields.
export const ESTABLISHMENT_TYPE_NAMES = new Set([
    // Primary types
    'cafe', 'café', 'coffee', 'coffee shop', 'кофейня', 'кафе',
    'restaurant', 'ресторан',
    'street food', 'streetfood', 'стритфуд', 'фастфуд', 'fast food',
    'bar', 'pub', 'бар', 'паб',
    'restobar', 'рестобар',
    'market', 'магазин', 'продукты',
    'bakery', 'пекарня', 'булочная',
    'winery', 'винодельня',
    'wine bar', 'винный бар',
    'pastry', 'кондитерская', 'pastry shop',
    'fine dining',
    'store', 'shop',
    'other',
])

// ─── Время визита ────────────────────────────────────────────────────────────
// Хранятся в поле best_for[] в БД.
// id совпадает со значением в best_for (e.g. 'morning', 'evening').
export const BEST_TIMES = [
    { id: 'morning',    label: 'Morning',    labelRu: 'Утро',          icon: '🌅' },
    { id: 'day',        label: 'Lunch',      labelRu: 'Ланч',          icon: '🍲' },
    { id: 'evening',    label: 'Evening',    labelRu: 'Вечер',         icon: '🌆' },
    { id: 'late_night', label: 'Night',      labelRu: 'Поздняя ночь',  icon: '🌙' },
]

// ─── Группы меток (Special Features & Labels) ───────────────────────────────
// Хранятся в поле special_labels[] в БД.
// Каждая группа содержит:
//   group    — EN ключ группы (для FilterModal)
//   groupRu  — RU название (для AdminLocationsPage)
//   items    — EN значения для Admin UI (статические fallback-значения)
//   itemsRu  — RU перевод для Admin UI
//
// ⚠️  CUISINE GROUP (idx=0): В FilterModal кухни берутся ДИНАМИЧЕСКИ из kg_cuisines
//     (useLocationsStore → dynamicCuisines). items здесь — только для Admin UI чекбоксов.
// ⚠️  ОСТАЛЬНЫЕ ГРУППЫ: items используются напрямую в FilterModal (статичные).
//
// ВАЖНО: items и itemsRu должны совпадать по индексу!
// В БД хранятся EN значения (items). RU только для отображения в Admin.

export const LABEL_GROUPS = [
    {
        group:   'Specialties',
        groupRu: 'Специализация и Меню',
        items: [
            'Signature Cuisine', 'Chef Cuisine', 'Fusion Cuisine', 'Street Food', 
            'Vegan Options', 'Gluten-Free Options', 'Vegetarian Options',
            'Local Ingredients', 'Farm to Table', 'Seasonal Menu', 'Raw Food', 'Molecular',
            'Specialty Coffee', 'Tasty Desserts', 'Homemade Desserts', 'Fresh Pastries', 'Kids Menu',
            'All Day Brunch', 'Zero Waste', 'Own Bakery', 'Wood-fired Oven',
        ],
        itemsRu: [
            'Авторская кухня', 'Шеф-кухня', 'Фьюжен', 'Стритфуд', 
            'Веганские опции', 'Безглютеновое меню', 'Вегетарианские опции',
            'Местные продукты', 'Farm to Table', 'Сезонное меню', 'Сыроедение (Raw)', 'Молекулярная кухня',
            'Спешиалти кофе', 'Вкусные десерты', 'Домашние десерты', 'Свежая выпечка', 'Детское меню',
            'Бранчи целый день', 'Zero Waste', 'Своя пекарня', 'Дровяная печь',
        ],
    },
    {
        group:   'Social & Occasion',
        groupRu: 'Повод и Атмосфера',
        items: [
            'Solo Dining', 'Date Night', 'Business Meeting', 'Family Sunday', 'Large Groups',
            'Laptop Friendly', 'Reading Corner', 'Quick Bite', 'Celebration', 'Hidden Gem',
            'Trendy', 'Local Favorite', 'Quiet Atmosphere', 'Lively Atmosphere', 'Romantic Setting',
            'Business Lunch', 'Late Dinner',
        ],
        itemsRu: [
            'Одиночный поход', 'Свидание', 'Деловая встреча', 'Семейный выход', 'Большие компании',
            'Работа с ноутбуком', 'Уголок для чтения', 'Быстрый перекус', 'Праздник', 'Скрытая жемчужина',
            'Трендовое место', 'Любимое у местных', 'Тихая атмосфера', 'Оживленная атмосфера', 'Романтическая обстановка',
            'Бизнес-ланч', 'Поздний ужин',
        ],
    },
    {
        group:   'Interior & Design',
        groupRu: 'Интерьер и Дизайн',
        items: [
            'Minimalist', 'Industrial Loft', 'Vintage', 'Art Deco', 'Modern', 
            'Garden Oasis', 'Panoramic View', 'Cozy', 'High Ceilings', 'Art Space',
            'Vinyl Music', 'Open Kitchen', 'Communal Table', 'Chef\'s Table',
        ],
        itemsRu: [
            'Минимализм', 'Индустриальный лофт', 'Винтаж / Ретро', 'Ар-деко', 'Модерн', 
            'Зеленый оазис', 'Панорамный вид', 'Уютно', 'Высокие потолки', 'Арт-пространство',
            'Виниловая музыка', 'Открытая кухня', 'Общий стол', 'Chef\'s Table',
        ],
    },
    {
        group:   'Facilities',
        groupRu: 'Удобства и Сервис',
        items: [
            'Outdoor Seating', 'Courtyard Terrace', 'Rooftop Terrace', 'Balconies',
            'Parking', 'WiFi', 'Charging Outlets', 'Wheelchair Accessible', 
            'Pet Friendly', 'Kids Play Area', 'High Chairs', 'Coworking Space', 'Board Games',
            'Delivery', 'Takeaway', 'Coat Check', 'Event Space', 'Hookah Available',
            'No Laptop Policy', 'Table Service', 'Counter Service',
            'Face Control', 'Dress Code',
        ],
        itemsRu: [
            'Места на улице', 'Терраса во дворе', 'Терраса на крыше', 'Балкончики',
            'Парковка', 'Бесплатный WiFi', 'Розетки для зарядки', 'Доступная среда', 
            'Pet friendly', 'Детская игровая зона', 'Детские стульчики', 'Рабочее место / Коворкинг', 'Настольные игры',
            'Доставка', 'Самовывоз', 'Гардероб', 'Место для мероприятий', 'Есть кальян',
            'Без ноутбуков', 'Обслуживание официантами', 'Заказ у стойки',
            'Фейсконтроль', 'Дресс-код',
        ],
    },
    {
        group:   'Drinks',
        groupRu: 'Бар и Напитки',
        items: [
            'Craft Cocktails', 'Wine List', 'Wine Tasting', 'Craft Beer', 'Wide Gin Selection',
            'Natural Wine', 'Specialty Tea', 'Kombucha', 'Mocktails', 'Guest Shifts',
            'Happy Hour', 'Extensive Wine List', 'Signature Cocktails',
            'Dance Floor', 'Karaoke', 'Sports Broadcasts', 'Live Music', 'DJ Sets',
        ],
        itemsRu: [
            'Авторские коктейли', 'Винная карта', 'Дегустация вин', 'Крафтовое пиво', 'Широкий выбор джина',
            'Натуральные вина', 'Спешиалти чай', 'Комбуча', 'Безалкогольные коктейли', 'Гостевые смены',
            'Счастливые часы', 'Обширная винная карта', 'Сигнатурные коктейли',
            'Танцпол', 'Караоке', 'Спортивные трансляции', 'Живая музыка', 'DJ сеты',
        ],
    },
    {
        group:   'Awards',
        groupRu: 'Награды и Статус',
        items: [
            'Michelin Star', 'Michelin Guide', 'Expert Choice', 'Best of Year',
        ],
        itemsRu: [
            'Звезда Мишлен', 'Гид Мишлен', 'Выбор экспертов', 'Лучшее за год',
        ],
    },
]

/**
 * Возвращает локализованный label для типа заведения по его id.
 */
export function getCategoryLabel(id, lang = 'en') {
    const type = ESTABLISHMENT_TYPES.find(t => t.id === id)
    if (!type) return id
    return lang === 'ru' ? (type.labelRu || type.label) : type.label
}

// ─── Вспомогательные функции ─────────────────────────────────────────────────

/**
 * Возвращает все EN-значения всех групп в виде плоского массива.
 * Используется в useLocationsStore для поиска по labels.
 */
export function getAllLabelValues() {
    return LABEL_GROUPS.flatMap(g => g.items)
}

/**
 * Преобразует LABEL_GROUPS в формат для AdminLocationsPage (LABEL_GROUPS_RU).
 * Ключ = groupRu, значение = itemsRu[].sort()
 */
export function getLabelGroupsRu() {
    return Object.fromEntries(
        LABEL_GROUPS.map(g => [
            g.groupRu,
            g.items.map((en, idx) => ({
                value: en,
                label: g.itemsRu[idx]
            })).sort((a, b) => a.label.localeCompare(b.label, 'ru'))
        ])
    )
}

/**
 * Список всех EN значений для конкретной группы по её EN-ключу.
 */
export function getLabelGroupByName(groupName) {
    return LABEL_GROUPS.find(g => g.group === groupName)?.items ?? []
}
