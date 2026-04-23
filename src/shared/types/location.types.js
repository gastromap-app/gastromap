/**
 * @fileoverview JSDoc типы для домена локаций (Locations) и AI
 * @see {@link https://supabase.com/docs/guid/database-schema}
 */

/**
 * Основная сущность локации (ресторан, кафе, бар и т.д.)
 * @typedef {Object} Location
 * @property {string} id - UUID локации
 * @property {string} title - Название заведения (каноническое поле)
 * @property {string} name - Алиас для title (для совместимости)
 * @property {'restaurant'|'cafe'|'bar'|'restobar'|'bakery'|'fine_dining'|'street_food'|'other'} category - Категория заведения
 * @property {string} city - Город
 * @property {string} address - Полный адрес
 * @property {string} country - Страна
 * @property {number} lat - Широта
 * @property {number} lng - Долгота
 * @property {string} description - Описание заведения
 * @property {string[]} cuisine_types - Массив типов кухни: ['Italian', 'Mediterranean'] ⚠️ НЕ 'cuisine'
 * @property {string} price_range - Диапазон цен: '$', '$$', '$$$', '$$$$' ⚠️ НЕ 'priceLevel'
 * @property {number} google_rating - Рейтинг Google (0-5)
 * @property {number} total_reviews - Количество отзывов
 * @property {string[]} tags - Теги атмосферы/особенностей: ['cozy', 'romantic', 'wine'] ⚠️ НЕ 'vibe'
 * @property {string[]} dietary_options - Диетические опции: ['vegetarian', 'vegan', 'gluten-free'] ⚠️ НЕ 'dietary'
 * @property {string[]} amenities - Удобства: ['wifi', 'parking', 'outdoor_seating'] ⚠️ НЕ 'features'
 * @property {string[]} best_for - Для каких случаев: ['date night', 'business lunch', 'groups']
 * @property {'quiet'|'moderate'|'lively'|'loud'} noise_level - Уровень шума
 * @property {boolean} outdoor_seating - Есть ли открытая терраса
 * @property {boolean} pet_friendly - Можно ли с животными
 * @property {boolean} child_friendly - Подходит ли для детей
 * @property {string} average_visit_duration - Средняя длительность посещения: '1-2 hours'
 * @property {string} ai_context - Контекст для AI ассистента
 * @property {string[]} ai_keywords - Ключевые слова для семантического поиска
 * @property {string} insider_tip - Инсайдерский совет (заполняется вручную)
 * @property {string} must_try - Что обязательно попробовать (заполняется вручную)
 * @property {string|null} phone - Телефон
 * @property {string|null} website - Веб-сайт
 * @property {string|null} image_url - URL изображения
 * @property {string|null} opening_hours - Часы работы (текст)
 * @property {object|null} google_opening_hours - Часы работы Google (объект)
 * @property {string|null} status - Статус: 'open', 'closed', 'permanently_closed'
 * @property {number} michelin_stars - Звезды Мишлен (0 если нет)
 * @property {boolean} michelin_bib - Есть ли рекомендация Мишлен Bib Gourmand
 * @property {string} created_at - Дата создания
 * @property {string} updated_at - Дата обновления
 */

/**
 * Карточка локации для отображения в UI (упрощённая версия)
 * @typedef {Object} LocationCard
 * @property {string} id
 * @property {string} title
 * @property {string} category
 * @property {string} city
 * @property {string} address
 * @property {number} lat
 * @property {number} lng
 * @property {string} description
 * @property {string[]} cuisine_types
 * @property {string} price_range
 * @property {number} google_rating
 * @property {string} image_url
 */

/**
 * Фильтры для поиска локаций
 * @typedef {Object} LocationFilters
 * @property {string} [city] - Город
 * @property {string[]} [cuisine_types] - Массив кухонь ⚠️ НЕ 'cuisine'
 * @property {string[]} [price_range] - Массив ценовых диапазонов ⚠️ НЕ 'price_level'
 * @property {string} [category] - Категория
 * @property {string[]} [tags] - Теги ⚠️ НЕ 'vibe'
 * @property {string[]} [dietary_options] - Диетические опции ⚠️ НЕ 'dietary'
 * @property {string[]} [amenities] - Удобства ⚠️ НЕ 'features'
 * @property {string[]} [best_for] - Случаи использования
 * @property {number} [min_rating] - Минимальный рейтинг
 * @property {string} [status] - Статус
 * @property {string} [query] - Поисковый запрос
 * @property {boolean} [michelin] - Только Мишлен
 * @property {string} [keyword] - Ключевое слово для поиска
 */

/**
 * Данные для создания/обновления локации (input от формы)
 * @typedef {Object} LocationInput
 * @property {string} [title] - Название
 * @property {string} [category] - Категория
 * @property {string} [city] - Город
 * @property {string} [address] - Адрес
 * @property {number} [lat] - Широта
 * @property {number} [lng] - Долгота
 * @property {string} [description] - Описание
 * @property {string[]} [cuisine_types] - Массив кухонь ⚠️ НЕ 'cuisine'
 * @property {string} [price_range] - Диапазон цен ⚠️ НЕ 'priceLevel' или 'price_level'
 * @property {string[]} [tags] - Теги ⚠️ НЕ 'vibe'
 * @property {string[]} [dietary_options] - Диетические опции ⚠️ НЕ 'dietary'
 * @property {string[]} [amenities] - Удобства ⚠️ НЕ 'features'
 * @property {string[]} [best_for] - Случаи использования
 * @property {string} [noise_level] - Уровень шума
 * @property {boolean} [outdoor_seating] - Открытая терраса
 * @property {boolean} [pet_friendly] - Можно с животными
 * @property {boolean} [child_friendly] - Подходит для детей
 * @property {string} [average_visit_duration] - Длительность посещения
 * @property {string} [ai_context] - AI контекст
 * @property {string[]} [ai_keywords] - AI ключевые слова
 * @property {string} [insider_tip] - Инсайдерский совет
 * @property {string} [must_try] - Что попробовать
 * @property {string} [phone] - Телефон
 * @property {string} [website] - Веб-сайт
 * @property {string} [image_url] - Изображение
 * @property {string} [opening_hours] - Часы работы
 * @property {number} [michelin_stars] - Звезды Мишлен
 * @property {boolean} [michelin_bib] - Рекомендация Мишлен Bib Gourmand
 */

/**
 * Результат AI enrichment для локации
 * @typedef {Object} LocationEnrichmentResult
 * @property {string} description - Описание
 * @property {string[]} cuisine_types - Массив кухонь ⚠️ НЕ 'cuisine'
 * @property {string[]} tags - Теги (максимум 8) ⚠️ НЕ 'vibe'
 * @property {string[]} dietary_options - Диетические опции ⚠️ НЕ 'dietary'
 * @property {string[]} amenities - Удобства ⚠️ НЕ 'features'
 * @property {string[]} best_for - Случаи использования (максимум 4)
 * @property {string} noise_level - Уровень шума
 * @property {string} price_range - Диапазон цен ⚠️ НЕ 'price_level'
 * @property {boolean} outdoor_seating - Терраса
 * @property {boolean} pet_friendly - Можно с животными
 * @property {boolean} child_friendly - Подходит для детей
 * @property {string} average_visit_duration - Длительность посещения
 * @property {string} ai_context - AI контекст
 * @property {string[]} ai_keywords - AI ключевые слова (5-8 штук)
 */

/**
 * Параметры для AI поиска локаций (Tool Use параметры)
 * @typedef {Object} AISearchParams
 * @property {string} [city] - Город
 * @property {string[]} [cuisine_types] - Массив кухонь ⚠️ НЕ 'cuisine'
 * @property {string[]} [tags] - Теги/атмосфера ⚠️ НЕ 'vibe'
 * @property {string[]} [price_range] - Массив ценовых диапазонов ⚠️ НЕ 'price_level'
 * @property {string} [category] - Категория
 * @property {string[]} [amenities] - Удобства ⚠️ НЕ 'features'
 * @property {string[]} [best_for] - Случаи использования
 * @property {string[]} [dietary_options] - Диетические опции ⚠️ НЕ 'dietary'
 * @property {number} [min_rating] - Минимальный рейтинг
 * @property {string} [keyword] - Ключевое слово для семантического поиска
 * @property {boolean} [michelin] - Только Мишлен
 * @property {number} [limit] - Максимум результатов (по умолчанию 5)
 */

export {}
