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
export const ESTABLISHMENT_TYPE_NAMES = new Set(
    ESTABLISHMENT_TYPES.filter(t => t.id !== 'all').map(t => t.id.toLowerCase())
)

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
        group:   'Cuisine & Menu',
        groupRu: 'Кухня и Меню',
        // Admin UI checkboxes — static list (filter uses live kg_cuisines instead)
        items: [
            'Signature Cuisine', 'Vegan Menu', 'Delicious Desserts', 'All Day Breakfast',
            'Local Products', 'Imported Products', 'Lunch Menu', 'Breakfast Menu', 'Fusion',
            'Italian', 'French', 'Japanese', 'Chinese', 'Greek', 'Spanish',
            'Mexican', 'Thai', 'Georgian', 'Polish', 'Israeli', 'American',
            'Mediterranean', 'Indian', 'Vietnamese', 'Turkish',
        ],
        itemsRu: [
            'Авторская кухня', 'Веганское меню', 'Вкусные десерты', 'Завтраки целый день',
            'Местные продукты', 'Импортные продукты', 'Меню ланча', 'Меню завтраков', 'Фьюжен',
            'Итальянская', 'Французская', 'Японская', 'Китайская', 'Греческая', 'Испанская',
            'Мексиканская', 'Тайская', 'Грузинская', 'Польская', 'Израильская', 'Американская',
            'Средиземноморская', 'Индийская', 'Вьетнамская', 'Турецкая',
        ],
    },
    {
        group:   'Bar & Drinks',
        groupRu: 'Бар и Напитки',
        items: [
            'Signature Cocktails', 'Wine List', 'Guest Shifts', 'Wine Tasting',
            'DJ Sets', 'Craft Beer', 'Cupping', 'Mixology', 'Specialty Coffee', 'Wide Gin Selection',
        ],
        itemsRu: [
            'Авторские коктейли', 'Винная карта', 'Гостевые смены', 'Дегустация вин',
            'DJ сеты', 'Крафтовое пиво', 'Каппинг', 'Миксология (без меню)', 'Спешиалти кофе', 'Широкий выбор джина',
        ],
    },
    {
        group:   'Atmosphere',
        groupRu: 'Атмосфера',
        items: [
            'Scenic View', 'Live Music', 'Coworking', 'Board Games',
            'Lively', 'Romantic', 'Speakeasy', 'Happy Hours', 'Themed Interior', 'Quiet Atmosphere', 'Cozy',
        ],
        itemsRu: [
            'Живописный вид', 'Живая музыка', 'Коворкинг', 'Настольные игры',
            'Оживленная атмосфера', 'Романтическая атмосфера', 'Скрытый вход (Speakeasy)',
            'Счастливые часы', 'Тематический интерьер', 'Тихая атмосфера', 'Уютно',
        ],
    },
    {
        group:   'Amenities & Service',
        groupRu: 'Удобства и Сервис',
        items: [
            'Balconies', 'Kids Area', 'High Chairs', 'Delivery',
            'Inclusive', 'Local Favorite', 'Parking', 'Pet friendly',
            'Takeaway', 'Courtyard Terrace', 'Rooftop Terrace', 'WiFi',
        ],
        itemsRu: [
            'Балкончики', 'Детская игровая зона', 'Детские стульчики', 'Доставка',
            'Инклюзивность', 'Любимое у местных', 'Парковка', 'Pet friendly',
            'Самовывоз', 'Терраса во дворе', 'Терраса на крыше', 'WiFi',
        ],
    },
    {
        group:   'Awards & Special',
        groupRu: 'Награды и Особое',
        items: [
            'Michelin Guide', 'Michelin Star', 'Hookah', 'Late Dinner',
        ],
        itemsRu: [
            'Гид Мишлен', 'Звезда Мишлен', 'Кальян', 'Поздний ужин',
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
        LABEL_GROUPS.map(g => [g.groupRu, [...g.itemsRu].sort()])
    )
}

/**
 * Список всех EN значений для конкретной группы по её EN-ключу.
 */
export function getLabelGroupByName(groupName) {
    return LABEL_GROUPS.find(g => g.group === groupName)?.items ?? []
}
