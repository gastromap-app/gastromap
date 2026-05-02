export const CUISINE_OPTIONS = [
    'Polish', 'Italian', 'Japanese', 'French', 'Mexican', 'Thai', 'Greek',
    'Georgian', 'Ukrainian', 'Spanish', 'Indian', 'Vietnamese', 'American',
    'Mediterranean', 'Israeli', 'Turkish', 'Chinese', 'Korean', 'Fusion',
]

// -----------------------------------------------------------------------------
// Время визита (Best for...)
// -----------------------------------------------------------------------------
export const BEST_TIMES = [
    { id: 'morning',    label: 'Morning',    labelRu: 'Утро',         labelPl: 'Rano',         labelUa: 'Ранок',          icon: '🌅' },
    { id: 'day',        label: 'Lunch',      labelRu: 'Ланч',         labelPl: 'Lunch',        labelUa: 'Ланч',           icon: '🍲' },
    { id: 'evening',    label: 'Evening',    labelRu: 'Вечер',        labelPl: 'Wieczór',      labelUa: 'Вечір',          icon: '🌆' },
    { id: 'late_night', label: 'Night',      labelRu: 'Поздняя ночь', labelPl: 'Późna noc',    labelUa: 'Пізня ніч',      icon: '🌙' },
];

export const VISIT_TIMES = BEST_TIMES; // Alias for backward compatibility


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

// ─── Emoji Maps ─────────────────────────────────────────────────────────────
// Frontend-only concerns; the database stores names, not emojis.

export const CUISINE_EMOJI_MAP = {
    'polish':           '🥟',
    'italian':          '🍝',
    'japanese':         '🍣',
    'french':           '🥐',
    'mexican':          '🌮',
    'thai':             '🍜',
    'greek':            '🫒',
    'georgian':         '🥩',
    'ukrainian':        '🌻',
    'spanish':          '🥘',
    'indian':           '🍛',
    'vietnamese':       '🍜',
    'american':         '🍔',
    'mediterranean':    '🫙',
    'israeli':          '🧆',
    'middle eastern':   '🧆',
    'turkish':          '🥙',
    'chinese':          '🥢',
    'korean':           '🍱',
    'fusion':           '🌍',
    'coffee':           '☕',
    'specialty coffee': '☕',
    'bar':              '🍸',
    'restobar':         '🍹',
    'cafe':             '☕',
    'bakery':           '🥐',
    'sushi':            '🍱',
    'pizza':            '🍕',
    'seafood':          '🦞',
    'vegan':            '🥗',
    'vegetarian':       '🥦',
    'steak':            '🥩',
    'burger':           '🍔',
    'ramen':            '🍜',
    'argentinian':      '🥩',
    'irish':            '🍺',
    'nordic':           '🐟',
    'scandinavian':     '🐟',
    'russian':          '🥣',
    'czech':            '🍺',
    'hungarian':        '🫕',
    'romanian':         '🫕',
    'balkan':           '🥩',
    'indonesian':       '🌶️',
    'malaysian':        '🌶️',
    'singaporean':      '🌶️',
    'filipino':         '🍖',
    'taiwanese':        '🧋',
    'cantonese':        '🥟',
    'szechuan':         '🌶️',
    'dim sum':          '🥟',
    'european':         '🇪🇺',
    'portuguese':       '🇵🇹',
    'german':           '🇩🇪',
    'british':          '🇬🇧',
    'asian fusion':     '🌏',
    'lebanese':         '🇱🇧',
    'moroccan':         '🇲🇦',
    'ethiopian':        '🇪🇹',
    'brazilian':        '🇧🇷',
    'peruvian':         '🇵🇪',
    'raw food':         '🥗',
    'molecular':        '🧪',
    'tapas':            '🥘',
    'bbq':              '🔥',
    'bakery & pastry':  '🥐',
    'international':    '🌐',
}

export const LABEL_EMOJI_MAP = {
    // Specialties
    "Signature Cuisine": "👨‍🍳",
    "Chef Cuisine": "👨‍🍳",
    "Fusion Cuisine": "🧪",
    "Street Food": "🍕",
    "Vegan Options": "🌱",
    "Gluten-Free Options": "🌾",
    "Vegetarian Options": "🥦",
    "Local Ingredients": "🚜",
    "Farm to Table": "🚜",
    "Seasonal Menu": "🥗",
    "Raw Food": "🥗",
    "Molecular": "🧪",
    "Specialty Coffee": "☕",
    "Tasty Desserts": "🍰",
    "Homemade Desserts": "🍰",
    "Fresh Pastries": "🥐",
    "Kids Menu": "🧸",
    "All Day Brunch": "🥞",
    "Zero Waste": "♻️",
    "Own Bakery": "🥐",
    "Wood-fired Oven": "🪵",

    // Vibe
    "Scenic View": "🔭",
    "Live Music": "🎸",
    "Co-working": "💻",
    "Board Games": "🎲",
    "Romantic Atmosphere": "🕯️",
    "Speakeasy": "🤫",
    "Happy Hours": "🕒",
    "Quiet Atmosphere": "🤫",
    "Cozy": "🛋️",
    "Lively Atmosphere": "🎉",
    "Date Night": "🕯️",
    "Business Meeting": "💼",
    "Business Lunch": "💼",
    "Late Night Dinner": "🌙",

    // Amenities
    "Balconies": "🪴",
    "Kids Play Area": "🧸",
    "Delivery": "🚲",
    "Inclusivity": "♿",
    "Local Favorite": "🏠",
    "Parking": "🅿️",
    "Pet Friendly": "🐾",
    "Takeaway": "🛍️",
    "Courtyard Terrace": "🌿",
    "Rooftop Terrace": "🌇",
    "WiFi": "📶",
    "Wardrobe": "🧥",
    "Facecontrol": "👤",
    "Dresscode": "👔",

    // Awards
    "Michelin Guide": "⭐",
    "Michelin Star": "🌟",
    "Expert Choice": "💎",
    "Hidden Gem": "💎",
    
    // Russian Legacy Map (for backward compatibility)
    "Авторская кухня": "👨‍🍳",
    "Веганское меню": "🌱",
    "Вкусные десерты": "🍰",
    "Завтраки целый день": "🥞",
    "Местные продукты": "🚜",
    "Меню завтраков": "🍳",
    "Меню ланча": "🍱",
    "Фьюжен": "🧪",
    "Крафтовое пиво": "🍺",
    "Спешиалти кофе": "☕",
    "Свидание": "🕯️",
    "Деловая встреча": "💼",
    "Бизнес-ланч": "💼",
    "Поздний ужин": "🌙",
    "Пет-френдли": "🐾",
    "Pet friendly": "🐾",
    "Гид Мишлен": "⭐",
    "Звезда Мишлен": "🌟",
    "Выбор экспертов": "💎",
    "Скрытая жемчужина": "💎",
}

export function getLabelEmoji(label) {
    if (!label) return '';
    if (LABEL_EMOJI_MAP[label]) return LABEL_EMOJI_MAP[label];
    const lower = label.toLowerCase();
    if (CUISINE_EMOJI_MAP[lower]) return CUISINE_EMOJI_MAP[lower];
    return '';
}

export const PRICE_LEVELS = [
    { value: '$',    label: '$ — бюджетно',  labelEn: '$ — Budget',  labelPl: '$ — Tanio',    labelUa: '$ — Бюджетно' },
    { value: '$$',   label: '$$ — средне',   labelEn: '$$ — Moderate', labelPl: '$$ — Średnio', labelUa: '$$ — Середньо' },
    { value: '$$$',  label: '$$$ — дорого',  labelEn: '$$$ — Expensive', labelPl: '$$$ — Drogo', labelUa: '$$$ — Дорого' },
    { value: '$$$$', label: '$$$$ — люкс',   labelEn: '$$$$ — Luxury', labelPl: '$$$$ — Luksus', labelUa: '$$$$ — Люкс' },
];

// --- Время визита ---
// (Moved to top of file to avoid initialization errors)

// ─── Типы заведений ─────────────────────────────────────────────────────────
// id    — значение, которое хранится в БД (поле category)
// label — что показывается пользователю
// icon  — эмодзи для кнопки фильтра
export const ESTABLISHMENT_TYPES = [
    { id: 'all',         label: 'All',        labelRu: 'Все',          labelPl: 'Wszystko',     labelUa: 'Все',           icon: '🌎' },
    { id: 'cafe',        label: 'Cafe',       labelRu: 'Кафе',         labelPl: 'Kawiarnia',    labelUa: 'Кафе',          icon: '☕' },
    { id: 'restaurant',  label: 'Restaurant', labelRu: 'Ресторан',     labelPl: 'Restauracja',  labelUa: 'Ресторан',      icon: '🍽️' },
    { id: 'street food', label: 'Street',     labelRu: 'Стритфуд',     labelPl: 'Street Food',  labelUa: 'Стрітфуд',      icon: '🍕' },
    { id: 'bar',         label: 'Bar',        labelRu: 'Бар',          labelPl: 'Bar',          labelUa: 'Бар',           icon: '🍸' },
    { id: 'restobar',    label: 'Restobar',   labelRu: 'Рестобар',     labelPl: 'Restobar',     labelUa: 'Рестобар',      icon: '🍹' },
    { id: 'market',      label: 'Market',     labelRu: 'Маркет',       labelPl: 'Market',       labelUa: 'Маркет',        icon: '🛒' },
    { id: 'bakery',      label: 'Bakery',     labelRu: 'Пекарня',      labelPl: 'Piekarnia',    labelUa: 'Пекарня',       icon: '🥐' },
    { id: 'winery',      label: 'Winery',     labelRu: 'Винодельня',   labelPl: 'Winnica',      labelUa: 'Виноробня',     icon: '🍷' },
    { id: 'wine bar',    label: 'Wine Bar',   labelRu: 'Винный бар',   labelPl: 'Winiarnia',    labelUa: 'Винний бар',    icon: '🍷' },
    { id: 'coffee',      label: 'Coffee',     labelRu: 'Кофе',         labelPl: 'Kawa',         labelUa: 'Кава',          icon: '☕' },
    { id: 'pastry',      label: 'Pastry',     labelRu: 'Кондитерская', labelPl: 'Cukiernia',    labelUa: 'Кондитерська',  icon: '🍰' },
    { id: 'fine dining', label: 'Fine Dining',labelRu: 'Fine Dining',  labelPl: 'Fine Dining',  labelUa: 'Fine Dining',   icon: '🎩' },
]

/** Compact public-facing subset used by the Suggest-a-Place wizard. */
export const CATEGORIES_PUBLIC = [
    { id: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
    { id: 'cafe',       label: 'Café',       emoji: '☕' },
    { id: 'bar',        label: 'Bar',        emoji: '🍺' },
    { id: 'restobar',   label: 'Restobar',   emoji: '🍹' },
    { id: 'bakery',     label: 'Bakery',     emoji: '🥐' },
    { id: 'other',      label: 'Other',      emoji: '📍' },
]

/** The canonical category list for admin/back-office forms. */
export const CATEGORIES_FULL = ESTABLISHMENT_TYPES.filter(t => t.id !== 'all').map(t => t.label);

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
        groupPl: 'Kuchnia i Menu',
        groupUa: 'Кухня та Меню',
        items: [], // Cuisines are added dynamically in FilterModal
    },
    {
        group:   'Specialties',
        groupRu: 'Специализация и Меню',
        groupPl: 'Specjalizacja i Menu',
        groupUa: 'Спеціалізація та Меню',
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
        itemsPl: [
            'Autorska kuchnia', 'Kuchnia szefa', 'Fusion', 'Street food', 
            'Opcje wegańskie', 'Menu bezglutenowe', 'Opcje wegetariańskie',
            'Lokalne produkty', 'Farm to Table', 'Menu sezonowe', 'Raw food', 'Kuchnia molekularna',
            'Specialty coffee', 'Pyszne desery', 'Domowe desery', 'Świeże wypieki', 'Menu dla dzieci',
            'Brunch cały dzień', 'Zero Waste', 'Własna piekarnia', 'Piec opalany drewnem',
        ],
        itemsUa: [
            'Авторська кухня', 'Шеф-кухня', 'Ф\'южн', 'Стрітфуд', 
            'Веганські опції', 'Безглютенове меню', 'Вегетаріанські опції',
            'Місцеві продукти', 'Farm to Table', 'Сезонное меню', 'Сироїдіння (Raw)', 'Молекулярна кухня',
            'Спешіалти кава', 'Смачні десерти', 'Домашні десерти', 'Свіжа випічка', 'Дитяче меню',
            'Бранчі цілий день', 'Zero Waste', 'Власна пекарня', 'Дров\'яна піч',
        ],
    },
    {
        group:   'Social & Occasion',
        groupRu: 'Повод и Атмосфера',
        groupPl: 'Okazja i Atmosfera',
        groupUa: 'Привід та Атмосфера',
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
        itemsPl: [
            'Wyjście w pojedynkę', 'Randka', 'Spotkanie biznesowe', 'Rodzinna niedziela', 'Duże grupy',
            'Przyjazne pracy', 'Kącik czytelniczy', 'Szybka przekąska', 'Uroczystość', 'Ukryty klejnot',
            'Modne miejsce', 'Ulubione u lokalnych', 'Cicha atmosfera', 'Gwarna atmosfera', 'Romantyczna sceneria',
            'Lunch biznesowy', 'Późna kolacja',
        ],
        itemsUa: [
            'Похід наодинці', 'Побачення', 'Ділова зустріч', 'Сімейний вихід', 'Великі компанії',
            'Робота з ноутбуком', 'Куточок для читання', 'Швидка перекуска', 'Свято', 'Прихована перлина',
            'Трендове місце', 'Улюблене у місцевих', 'Тиха атмосфера', 'Жвава атмосфера', 'Романтична обстановка',
            'Бізнес-ланч', 'Пізня вечеря',
        ],
    },
    {
        group:   'Interior & Design',
        groupRu: 'Интерьер и Дизайн',
        groupPl: 'Wnętrze i Design',
        groupUa: 'Інтер\'єр та Дизайн',
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
        itemsPl: [
            'Minimalizm', 'Industrialny loft', 'Vintage / Retro', 'Art Deco', 'Modern', 
            'Zielona oaza', 'Widok panoramiczny', 'Przytulnie', 'Wysokie sufity', 'Przestrzeń artystyczna',
            'Muzyka z winyli', 'Otwarta kuchnia', 'Wspólny stół', 'Chef\'s Table',
        ],
        itemsUa: [
            'Мінімалізм', 'Індустріальний лофт', 'Вінтаж / Ретро', 'Ар-деко', 'Модерн', 
            'Зелений оазис', 'Панорамний вид', 'Затишно', 'Високі стелі', 'Арт-простір',
            'Вінілова музика', 'Відкрита кухня', 'Спільний стіл', 'Chef\'s Table',
        ],
    },
    {
        group:   'Facilities',
        groupRu: 'Удобства и Сервис',
        groupPl: 'Udogodnienia i Serwis',
        groupUa: 'Зручності та Сервіс',
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
        itemsPl: [
            'Miejsca na zewnątrz', 'Taras na dziedzińcu', 'Taras na dachu', 'Balkoniki',
            'Parking', 'Darmowe WiFi', 'Gniazdka do ładowania', 'Dostępność dla wózków', 
            'Przyjazne zwierzętom', 'Strefa dla dzieci', 'Krzesełka dla dzieci', 'Przestrzeń do pracy', 'Gry planszowe',
            'Dostawa', 'Na wynos', 'Garderoba', 'Przestrzeń eventowa', 'Dostępna fajka wodna',
            'Zakaz laptopów', 'Obsługa kelnerska', 'Obsługa przy ladzie',
            'Face control', 'Dress code',
        ],
        itemsUa: [
            'Місця на вулиці', 'Тераса у дворі', 'Тераса на даху', 'Балкончики',
            'Парковка', 'Безкоштовний WiFi', 'Розетки для зарядки', 'Доступне середовище', 
            'Pet friendly', 'Дитяча ігрова зона', 'Дитячі стільчики', 'Робоче місце / Коворкинг', 'Настільні ігри',
            'Доставка', 'Самовивіз', 'Гардероб', 'Місце для заходів', 'Є кальян',
            'Без ноутбуків', 'Обслуговування офіціантами', 'Замовлення біля стійки',
            'Фейсконтроль', 'Дрес-код',
        ],
    },
    {
        group:   'Drinks',
        groupRu: 'Бар и Напитки',
        groupPl: 'Bar i Napoje',
        groupUa: 'Бар та Напої',
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
        itemsPl: [
            'Koktajle rzemieślnicze', 'Karta win', 'Degustacja win', 'Piwo rzemieślnicze', 'Szeroki wybór ginu',
            'Wina naturalne', 'Herbata specialty', 'Kombucha', 'Mocktaile', 'Gościnne zmiany',
            'Happy Hour', 'Bogata karta win', 'Koktajle autorskie',
            'Parkiet', 'Karaoke', 'Transmisje sportowe', 'Muzyka na żywo', 'DJ sety',
        ],
        itemsUa: [
            'Авторські коктейлі', 'Винна карта', 'Дегустація вин', 'Крафтове пиво', 'Широкий вибір джину',
            'Натуральні вина', 'Спешіалти чай', 'Комбуча', 'Безалкогольні коктейлі', 'Гостьові зміни',
            'Щасливі години', 'Велика винна карта', 'Сигнатурні коктейлі',
            'Танцмайданчик', 'Караоке', 'Спортивні трансляції', 'Жива музика', 'DJ сети',
        ],
    },
    {
        group:   'Awards',
        groupRu: 'Награды и Статус',
        groupPl: 'Nagrody i Status',
        groupUa: 'Нагороди та Статус',
        items: [
            'Michelin Star', 'Michelin Guide', 'Expert Choice', 'Best of Year',
        ],
        itemsRu: [
            'Звезда Мишлен', 'Гид Мишлен', 'Выбор экспертов', 'Лучшее за год',
        ],
        itemsPl: [
            'Gwiazdka Michelin', 'Przewodnik Michelin', 'Wybór ekspertów', 'Najlepsze w roku',
        ],
        itemsUa: [
            'Зірка Мішлен', 'Гід Мішлен', 'Вибір експертів', 'Найкраще за рік',
        ],
    },
]

/**
 * Returns a translated label for any value (category, best time, or special label)
 */
export const getLabelTranslation = (value, lang = 'en') => {
    if (!value) return value;
    
    // Check if it's a category
    const category = ESTABLISHMENT_TYPES.find(t => t.id === value);
    if (category) {
        if (lang === 'ru') return category.labelRu;
        if (lang === 'pl') return category.labelPl;
        if (lang === 'ua') return category.labelUa;
        return category.label;
    }
    
    // Check if it's a best time
    const time = BEST_TIMES.find(t => t.id === value);
    if (time) {
        if (lang === 'ru') return time.labelRu;
        if (lang === 'pl') return time.labelPl;
        if (lang === 'ua') return time.labelUa;
        return time.label;
    }
    
    // Check in label groups
    for (const group of LABEL_GROUPS) {
        const idx = group.items.indexOf(value);
        if (idx !== -1) {
            if (lang === 'ru') return group.itemsRu?.[idx] ?? value;
            if (lang === 'pl') return group.itemsPl?.[idx] ?? value;
            if (lang === 'ua') return group.itemsUa?.[idx] ?? value;
            return value;
        }
    }
    
    return value;
};

/**
 * Возвращает локализованный label для типа заведения по его id.
 */
export function getCategoryLabel(id, lang = 'en') {
    return getLabelTranslation(id, lang);
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
 * Преобразует LABEL_GROUPS в локализованный формат для UI.
 */
export function getLabelGroups(lang = 'ru') {
    return LABEL_GROUPS.map(g => {
        // Determine group name based on language
        let groupName = g.group;
        if (lang === 'ru') groupName = g.groupRu || g.group;
        else if (lang === 'pl') groupName = g.groupPl || g.group;
        else if (lang === 'ua') groupName = g.groupUa || g.group;

        // Map and translate items
        const localizedItems = g.items.map((enValue, idx) => {
            let label = enValue;
            if (lang === 'ru') label = g.itemsRu?.[idx] || enValue;
            else if (lang === 'pl') label = g.itemsPl?.[idx] || enValue;
            else if (lang === 'ua') label = g.itemsUa?.[idx] || enValue;

            return {
                value: enValue,
                label: label
            };
        }).sort((a, b) => a.label.localeCompare(b.label, lang));

        return {
            group: groupName,
            items: localizedItems
        };
    });
}

/**
 * @deprecated Use getLabelGroups(lang) instead
 */
export function getLabelGroupsRu() {
    return getLabelGroups('ru');
}

/**
 * Список всех EN значений для конкретной группы по её EN-ключу.
 */
export function getLabelGroupByName(groupName) {
    return LABEL_GROUPS.find(g => g.group === groupName)?.items ?? []
}
