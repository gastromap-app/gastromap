import { MOCK_USER_PERSONA } from '../mocks/userPersona';

/**
 * GastroIntelligence Service
 * Local fallback engine — used when no OpenRouter API key is configured.
 */
class GastroIntelligence {
    constructor() {
        this.user = MOCK_USER_PERSONA;
    }

    /**
     * Process a user message and return an intelligent response.
     * Supports English and Russian input via keyword matching.
     *
     * @param {string} text - User query
     * @param {Array} [locations] - Live locations from store (falls back to MOCK_LOCATIONS)
     */
    async analyzeQuery(text, locations) {
        const query = text.toLowerCase();
        const pool = (locations?.length > 0) ? locations : [];

        if (pool.length === 0) {
            return {
                content: "I'm your GastroGuide! Ask me where to eat, what to try, or for recommendations based on your mood. Make sure you're connected to the internet so I can search the database for you.",
                matches: [],
            };
        }

        // Multilingual food/recommendation intent detection (EN + RU)
        const isRecommendation =
            /\b(eat|cafe|where|recommend|dinner|lunch|breakfast|restaurant|bar|restobar|coffee|cozy|romantic|best|find|хочу|поесть|кафе|где|советуй|рекомендуй|ужин|обед|завтрак|ресторан|бар|рестобар|кофе|найди|лучший|хорош|уютн|романтич)\b/.test(query);

        let filtered = pool;

        if (isRecommendation && pool.length > 0) {
            filtered = pool.map(loc => {
                let score = 0;
                const tags = Array.isArray(loc.tags) ? loc.tags : [];
                const vibes = Array.isArray(loc.vibe) ? loc.vibe : (loc.vibe ? [loc.vibe] : []);
                const features = Array.isArray(loc.features) ? loc.features : [];

                tags.forEach(tag => {
                    if (this.user.preferences.favoriteCuisines.some(c => c.toLowerCase() === tag.toLowerCase())) score += 2;
                });
                vibes.forEach(v => {
                    if (this.user.preferences.vibePreference.some(p => p.toLowerCase() === v.toLowerCase())) score += 1;
                });
                features.forEach(f => {
                    if (this.user.preferences.features.some(p => p.toLowerCase() === f.toLowerCase())) score += 1;
                });
                if ((loc.google_rating ?? loc.rating ?? 0) >= 4.5) score += 1;

                return { ...loc, matchScore: score };
            }).sort((a, b) => b.matchScore - a.matchScore);
        }

        const topMatch = filtered[0];

        if (topMatch && (topMatch.matchScore ?? 0) > 0) {
            const topThree = filtered.slice(0, 3);
            return {
                content: `Based on your taste profile, I recommend **${topMatch.title}** — rated ${topMatch.google_rating ?? topMatch.rating}★${topMatch.features?.length ? `, featuring ${topMatch.features.slice(0, 2).join(' & ')}` : ''}.${topThree.length > 1 ? ` Also check out ${topThree.slice(1).map(l => l.title).join(' and ')}.` : ''}`,
                matches: topThree,
            };
        }

        if (isRecommendation && topMatch) {
            return {
                content: `Here's a top pick: **${topMatch.title}**${topMatch.category ? ` (${topMatch.category})` : ''} — rated ${topMatch.google_rating ?? topMatch.rating ?? '?'}★. ${topMatch.description ?? ''}`,
                matches: filtered.slice(0, 3),
            };
        }

        return {
            content: "I'm your GastroGuide! Ask me where to eat, what to try, or for recommendations based on your mood. Make sure you're connected to the internet so I can search the database for you.",
            matches: [],
        };
    }
}

export const gastroIntelligence = new GastroIntelligence();
