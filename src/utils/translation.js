export const LABEL_TRANSLATIONS = {
    // Groups
    "Кухня и Меню": "Cuisine & Menu",
    "Бар и Напитки": "Bar & Drinks",
    "Атмосфера": "Atmosphere",
    "Удобства и Сервис": "Amenities & Service",
    "Награды": "Awards & Special",

    // Cuisine & Menu
    "Авторская кухня": "Signature Cuisine",
    "Веганское меню": "Vegan Menu",
    "Вкусные десерты": "Delicious Desserts",
    "Завтраки целый день": "All Day Breakfast",
    "Импортные продукты": "Imported Products",
    "Местные продукты": "Local Products",
    "Меню завтраков": "Breakfast Menu",
    "Меню ланча": "Lunch Menu",
    "Фьюжен": "Fusion",
    "Итальянская": "Italian",
    "Французская": "French",
    "Японская": "Japanese",
    "Китайская": "Chinese",
    "Греческая": "Greek",
    "Испанская": "Spanish",
    "Мексиканская": "Mexican",
    "Тайская": "Thai",
    "Грузинская": "Georgian",
    "Польская": "Polish",
    "Израильская": "Israeli",
    "Американская": "American",
    "Средиземноморская": "Mediterranean",
    "Индийская": "Indian",
    "Вьетнамская": "Vietnamese",
    "Турецкая": "Turkish",

    // Bar & Drinks
    "Авторские коктейли": "Signature Cocktails",
    "Винная карта": "Wine List",
    "Гостевые смены": "Guest Shifts",
    "Дегустация вин": "Wine Tasting",
    "DJ сеты": "DJ Sets",
    "Крафтовое пиво": "Craft Beer",
    "Миксология (без меню)": "Mixology",
    "Спешиалти кофе": "Specialty Coffee",
    "Широкий выбор джина": "Wide Gin Selection",

    // Atmosphere
    "Живописный вид": "Scenic View",
    "Живая музыка": "Live Music",
    "Коворкинг": "Coworking",
    "Настольные игры": "Board Games",
    "Оживленная атмосфера": "Lively Atmosphere",
    "Романтическая атмосфера": "Romantic",
    "Скрытый вход (Speakeasy)": "Speakeasy",
    "Счастливые часы": "Happy Hours",
    "Тематический интерьер": "Themed Interior",
    "Тихая атмосфера": "Quiet Atmosphere",
    "Уютно": "Cozy",

    // Amenities & Service
    "Балкончики": "Balconies",
    "Детская игровая зона": "Kids Area",
    "Детские стульчики": "High Chairs",
    "Доставка": "Delivery",
    "Инклюзивность": "Inclusive",
    "Любимое у местных": "Local Favorite",
    "Парковка": "Parking",
    "Pet friendly": "Pet friendly",
    "Самовывоз": "Takeaway",
    "Терраса во дворе": "Courtyard Terrace",
    "Терраса на крыше": "Rooftop Terrace",
    "WiFi": "WiFi",

    // Awards & Special
    "Гид Мишлен": "Michelin Guide",
    "Звезда Мишлен": "Michelin Star",
    "Кальян": "Hookah",
    "Поздний ужин": "Late Dinner",
    "Скрытая жемчужина": "Hidden Gem",



    // Times
    "Утро": "Morning",
    "День": "Day",
    "Вечер": "Evening",
    "Поздняя ночь": "Late Night",
    "Ночь": "Night",

    // Establishment Types (Categories)
    "Кафе": "Cafe",
    "Ресторан": "Restaurant",
    "Стритфуд": "Street Food",
    "Бар": "Bar",
    "Рестобар": "Restobar",
    "Маркет": "Market",
    "Пекарня": "Bakery",
    "Винодельня": "Winery",
    "Кофе": "Coffee",
    "Кондитерская": "Pastry"
};

export const translate = (text) => {
    if (!text) return text;
    return LABEL_TRANSLATIONS[text] || text;
};

// Reverse mapping for EN -> RU translation
const REVERSE_TRANSLATIONS = Object.fromEntries(
    Object.entries(LABEL_TRANSLATIONS).map(([ru, en]) => [en, ru])
);

export const translateToRu = (text) => {
    if (!text) return text;
    return REVERSE_TRANSLATIONS[text] || text;
};
