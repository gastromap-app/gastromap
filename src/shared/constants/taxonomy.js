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

// The canonical 12-item category list for admin/back-office forms.
export const CATEGORIES_FULL = [
    'Cafe', 'Restaurant', 'Street Food', 'Bar', 'Restobar', 'Market',
    'Bakery', 'Winery', 'Store', 'Coffee Shop', 'Pastry Shop', 'Fine Dining', 'Other'
]

// Compact public-facing subset used by the Suggest-a-Place wizard.
export const CATEGORIES_PUBLIC = [
    { id: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
    { id: 'cafe',       label: 'Café',       emoji: '☕' },
    { id: 'bar',        label: 'Bar',        emoji: '🍺' },
    { id: 'restobar',   label: 'Restobar',   emoji: '🍹' },
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

/**
 * CUISINE_EMOJI_MAP — display-only emoji for each cuisine by name (lowercase).
 * This is a pure frontend concern; the KG stores names, not emojis.
 * Add a new entry here whenever a new cuisine is added to the KG.
 * Unknown cuisines fall back to '🍴'.
 */
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
    'tapas':            '🫙',
    'lebanese':         '🧆',
    'moroccan':         '🫕',
    'ethiopian':        '🫓',
    'peruvian':         '🐟',
    'brazilian':        '🥩',
    'argentinian':      '🥩',
    'german':           '🌭',
    'british':          '🫖',
    'irish':            '🍺',
    'nordic':           '🐟',
    'scandinavian':     '🐟',
    'russian':          '🥣',
    'czech':            '🍺',
    'hungarian':        '🫕',
    'romanian':         '🫕',
    'balkan':           '🥩',
    'portuguese':       '🐟',
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
        "Танцпол", "Караоке", "Спортивные трансляции",
    ].sort(),
    "Атмосфера": [
        "Живописный вид", "Живая музыка", "Коворкинг", "Настольные игры",
        "Романтическая атмосфера", "Скрытый вход (Speakeasy)",
        "Счастливые часы", "Тихая атмосфера", "Уютно", "Оживлённая атмосфера",
        "Свидание", "Деловая встреча", "Бизнес-ланч", "Поздний ужин",
    ].sort(),
    "Удобства и Сервис": [
        "Балкончики", "Детская игровая зона", "Доставка", "Инклюзивность",
        "Любимое у местных", "Парковка", "Pet friendly",
        "Самовывоз", "Терраса во дворе", "Терраса на крыше", "WiFi",
        "Гардероб", "Фейсконтроль", "Дресс-код",
    ].sort(),
    "Награды": ["Гид Мишлен", "Звезда Мишлен", "Выбор экспертов", "Скрытая жемчужина"].sort(),
}

export const LABEL_EMOJI_MAP = {
    // Кухня и Меню (RU)
    "Авторская кухня": "👨‍🍳",
    "Веганское меню": "🌱",
    "Вкусные десерты": "🍰",
    "Завтраки целый день": "🥞",
    "Местные продукты": "🚜",
    "Меню завтраков": "🍳",
    "Меню ланча": "🍱",
    "Фьюжен": "🧪",
    "Бранчи целый день": "🥞",
    "Zero Waste": "♻️",
    "Своя пекарня": "🥐",
    "Дровяная печь": "🪵",

    // Бар и Напитки (RU)
    "Авторские коктейли": "🍸",
    "Винная карта": "🍷",
    "Гостевые смены": "🤝",
    "Дегустация вин": "🥂",
    "DJ сеты": "🎧",
    "Крафтовое пиво": "🍺",
    "Спешиалти кофе": "☕",
    "Широкий выбор джина": "🍸",
    "Натуральные вина": "🍇",
    "Спешиалти чай": "🍵",
    "Комбуча": "🍶",
    "Безалкогольные коктейли": "🍹",
    "Обширная винная карта": "🍷",
    "Сигнатурные коктейли": "🍹",
    "Счастливые часы": "🕒",

    // Повод и Атмосфера (RU)
    "Одиночный поход": "👤",
    "Свидание": "🕯️",
    "Деловая встреча": "💼",
    "Семейный выход": "👨‍👩‍👧‍👦",
    "Большие компании": "👥",
    "Работа с ноутбуком": "💻",
    "Уголок для чтения": "📚",
    "Быстрый перекус": "🥪",
    "Праздник": "🥳",
    "Трендовое место": "📈",
    "Любимое у местных": "🏠",
    "Тихая атмосфера": "🤫",
    "Оживленная атмосфера": "🎉",
    "Романтическая обстановка": "🕯️",

    // Дизайн (RU)
    "Минимализм": "⚪",
    "Индустриальный лофт": "🧱",
    "Винтаж / Ретро": "📻",
    "Ар-деко": "🏛️",
    "Модерн": "🎨",
    "Зеленый оазис": "🌿",
    "Панорамный вид": "🔭",
    "Высокие потолки": "🏛️",
    "Арт-пространство": "🎭",
    "Виниловая музыка": "📻",
    "Открытая кухня": "🍳",
    "Общий стол": "🪵",
    "Chef's Table": "👨‍🍳",

    // Удобства (RU)
    "Балкончики": "🪴",
    "Детская игровая зона": "🧸",
    "Доставка": "🚲",
    "Инклюзивность": "♿",
    "Парковка": "🅿️",
    "Pet friendly": "🐾",
    "Самовывоз": "🛍️",
    "Терраса во дворе": "🌿",
    "Терраса на крыше": "🌇",
    "WiFi": "📶",
    "Без ноутбуков": "🚫💻",
    "Обслуживание официантами": "🤵",
    "Заказ у стойки": "💁",

    // Награды (RU)
    "Гид Мишлен": "⭐",
    "Звезда Мишлен": "🌟",
    "Выбор экспертов": "💎",
    "Лучшее за год": "🏆",
    "Скрытая жемчужина": "💎",
    "Кальян": "💨",
    "Поздний ужин": "🌙",
    "Бизнес-ланч": "💼",
    "Танцпол": "💃",
    "Караоке": "🎤",
    "Спортивные трансляции": "⚽",
    "Фейсконтроль": "👤",
    "Дресс-код": "👔",
    "Гардероб": "🧥",
}

/**
 * Helper to get emoji for any label (English, Russian, or Cuisine)
 */
export const getLabelEmoji = (label) => {
    if (!label) return '';
    
    // 1. Direct match in label map (covers RU and EN labels)
    if (LABEL_EMOJI_MAP[label]) return LABEL_EMOJI_MAP[label];
    
    // 2. Try cuisine map (handles lowercase English from KG)
    const lower = label.toLowerCase();
    if (CUISINE_EMOJI_MAP[lower]) return CUISINE_EMOJI_MAP[lower];
    
    return '';
}

export const VISIT_TIMES = [
    { id: 'morning',    label: 'Утро',  emoji: '🌅' },
    { id: 'day',        label: 'День',  emoji: '☀️' },
    { id: 'evening',    label: 'Вечер', emoji: '🌆' },
    { id: 'late_night', label: 'Ночь',  emoji: '🌙' },
]
