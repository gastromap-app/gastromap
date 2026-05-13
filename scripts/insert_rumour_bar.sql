-- ============================================================
-- INSERT: Rumour Cocktail Bar | Kraków, Poland
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

INSERT INTO locations (
  title,
  category,
  country,
  city,
  city_slug,
  country_slug,
  address,
  description,
  insider_tip,
  must_try,
  price_range,
  phone,
  opening_hours,
  lat,
  lng,
  is_hidden_gem,
  is_featured,
  status,
  vibe,
  tags,
  best_time_to_visit,
  best_for,
  noise_level,
  outdoor_seating,
  pet_friendly,
  child_friendly,
  reservation_required,
  google_rating,
  google_user_ratings_total,
  google_price_level,
  google_formatted_address,
  google_vicinity,
  google_maps_url,
  social_instagram,
  amenities,
  cuisine_types,
  what_to_try,
  special_labels,
  average_visit_duration,
  ai_enriched,
  ai_description_generated,
  ai_insider_tip_generated,
  ai_must_try_generated
) VALUES (
  -- ── Core ──────────────────────────────────────────────────
  'Rumour Cocktail Bar',
  'Bar',
  'Poland',
  'Kraków',
  'krakow',
  'poland',
  'ul. Pijarska 9, 31-015 Kraków',

  -- ── Description ───────────────────────────────────────────
  'Rumour Cocktail Bar is an atmospheric speakeasy hidden in the shadow of the ancient Florian Gate. The bar positions itself as a sanctuary for connoisseurs of fine spirits, with a primary focus on collector rum. The interior immerses you in the twilight of the Prohibition era: dim lighting, vintage furniture, and jazz undertones create the perfect backdrop for theatrical mixology. Here a cocktail is not just a drink — it is a performance staged by expert bartenders exclusively for you.',

  -- ── Insider Tip ───────────────────────────────────────────
  'Getting in is already a small adventure. Look for the discreet entrance in the archway on Pijarska Street; you may need to ring the bell to have the door opened — this is all part of the private-club experience. Pro tip: do not order "just a mojito". Leverage the bartenders'' expertise — tell them your flavour preferences (e.g. "woody, dry, with a hint of citrus") and they will select a rare rum or craft a bespoke twist not found on the menu. Bonus: shortly after being seated you will likely receive complimentary cucumber water and snacks — a small touch that perfectly refreshes the palate. Reservations (especially Friday–Saturday) are strongly recommended, as the venue is intimate and fills up quickly.',

  -- ── Must Try ──────────────────────────────────────────────
  'Signature Theatrical Cocktails — order items marked "Signature" or ask the bartender which drink has the most dramatic presentation (smoke, fire, or unique glassware); guests consistently rate the visual element among the best in the city. Rum Flight — ask the bartender to compose a mini-set of 3 rums: a Martinique agricole, an aged Cuban, and a spiced Caribbean. Pornstar Martini (bar''s own twist).',

  -- ── Logistics ─────────────────────────────────────────────
  '$$',
  '+48 796 851 659',
  'Mon–Thu & Sun: 17:00–00:00 | Fri–Sat: 17:00–02:00',

  -- ── Geo ───────────────────────────────────────────────────
  50.0642,
  19.9382,

  -- ── Flags ─────────────────────────────────────────────────
  true,   -- is_hidden_gem
  true,   -- is_featured
  'approved',

  -- ── Arrays ────────────────────────────────────────────────
  ARRAY['Romantic', 'Lively', 'Hidden Gem'],  -- vibe
  ARRAY['speakeasy', 'rum bar', 'cocktail bar', 'craft cocktails', 'hidden bar',
        'Kraków nightlife', 'mixology', 'vintage', 'jazz', 'Prohibition era',
        'Florian Gate', 'date night', 'special occasion'],  -- tags
  ARRAY['Evening', 'Night'],                  -- best_time_to_visit
  ARRAY['Date Night', 'Drinks', 'Special Occasion', 'Cocktail Lovers'],  -- best_for

  -- ── Ambience ──────────────────────────────────────────────
  'Moderate',  -- noise_level
  false,       -- outdoor_seating
  false,       -- pet_friendly
  false,       -- child_friendly
  true,        -- reservation_required

  -- ── Google data ───────────────────────────────────────────
  4.9,    -- google_rating
  1050,   -- google_user_ratings_total
  3,      -- google_price_level ($$$ = upscale)
  'ul. Pijarska 9, 31-015 Kraków, Poland',
  'Pijarska 9, Kraków Old Town',
  'https://maps.google.com/?q=Rumour+Cocktail+Bar+Pijarska+9+Krakow',

  -- ── Social ────────────────────────────────────────────────
  'https://www.instagram.com/rumour_cocktail_bar/',

  -- ── Features ──────────────────────────────────────────────
  ARRAY['Table Service', 'Card Payments', 'Reservations', 'Private Events'],  -- amenities
  ARRAY['Cocktails', 'Rum', 'Spirits'],                                        -- cuisine_types
  ARRAY['Signature Theatrical Cocktail', 'Rum Flight (3 rums)', 'Pornstar Martini (bar twist)'],  -- what_to_try
  ARRAY['Hidden Gem', 'Speakeasy'],  -- special_labels

  -- ── Meta ──────────────────────────────────────────────────
  120,   -- average_visit_duration (minutes)
  true,  -- ai_enriched
  true,  -- ai_description_generated
  true,  -- ai_insider_tip_generated
  true   -- ai_must_try_generated
)
ON CONFLICT DO NOTHING
RETURNING id, title, city, status, lat, lng;
