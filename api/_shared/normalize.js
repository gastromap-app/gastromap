// City normalization map (Polish → English canonical names)
// Shared between api/locations/enrich.js and scripts/enrich-all-locations.mjs
export const CITY_MAP = {
  'kraków': 'Krakow', 'krakow': 'Krakow', 'cracow': 'Krakow',
  'warszawa': 'Warsaw', 'warsaw': 'Warsaw',
  'gdańsk': 'Gdansk', 'gdansk': 'Gdansk',
  'wrocław': 'Wroclaw', 'wroclaw': 'Wroclaw',
  'łódź': 'Lodz', 'lodz': 'Lodz',
  'poznań': 'Poznan', 'poznan': 'Poznan',
  'katowice': 'Katowice',
  'szczecin': 'Szczecin',
  'lublin': 'Lublin',
  'białystok': 'Bialystok', 'bialystok': 'Bialystok',
  'toruń': 'Torun', 'torun': 'Torun',
  'rzeszów': 'Rzeszow', 'rzeszow': 'Rzeszow',
  'kielce': 'Kielce',
  'olsztyn': 'Olsztyn',
  'opole': 'Opole',
  'zakopane': 'Zakopane',
  'sopot': 'Sopot',
  'gdynia': 'Gdynia',
}

/**
 * Normalize a city name to its canonical English form.
 * Trims whitespace, lowercases for lookup, returns canonical name or trimmed input.
 * @param {string|null|undefined} name
 * @returns {string|null|undefined}
 */
export function normalizeCity(name) {
  if (!name) return name
  const trimmed = name.trim()
  if (!trimmed) return trimmed
  const lower = trimmed.toLowerCase()
  return CITY_MAP[lower] || trimmed
}

/**
 * Strip diacritical marks (combining characters) from a string using NFD normalization.
 * Handles Polish characters: ą→a, ć→c, ę→e, ł→l, ń→n, ó→o, ś→s, ź→z, ż→z
 * and their uppercase equivalents.
 * @param {string|null|undefined} str
 * @returns {string|null|undefined}
 */
export function normalizeDiacritics(str) {
  if (!str) return str
  // Handle ł/Ł separately — NFD doesn't decompose these
  const withoutStroke = str.replace(/ł/g, 'l').replace(/Ł/g, 'L')
  // NFD decomposes characters like ó into o + combining acute accent,
  // then we strip all combining marks (U+0300–U+036F)
  return withoutStroke.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
