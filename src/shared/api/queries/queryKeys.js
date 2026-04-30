/**
 * Centralized Query Keys for React Query cache management.
 * Use these constants to avoid string typos and maintain a predictable cache structure.
 */
export const queryKeys = {
    // ─── Locations ───
    locations: {
        all: ['locations'],
        filtered: (filters) => ['locations', 'filtered', filters],
        detail: (id) => ['locations', 'detail', id],
        nearby: (coords) => ['locations', 'nearby', coords],
        pending: ['pending-locations'],
        recent: (limit) => ['recent-locations', limit],
        top: (limit) => ['top-locations', limit],
    },
    categories: ['categories'],
    
    // ─── Admin & Stats ───
    admin: {
        stats: ['admin-stats'],
        activity: (limit) => ['recent-activity', limit],
        profiles: ['profiles'],
        userDetails: (userId) => ['user-details', userId],
        categoryStats: ['category-stats'],
        engagement: ['detailed-engagement'],
        cityStats: ['city-stats'],
        reviewsTimeline: (days) => ['reviews-timeline', days],
        userGrowth: (days) => ['user-growth', days],
    },

    // ─── Social & Interactions ───
    reviews: {
        byLocation: (id) => ['reviews', id],
        byUser: (userId) => ['user-reviews', userId],
        pending: ['pending-reviews'],
    },
    favorites: {
        all: (userId) => ['favorites', userId],
        withLocations: (userId) => ['favorites-with-locations', userId],
    },
    visits: {
        all: (userId) => ['visits', userId],
        withLocations: (userId) => ['visits-with-locations', userId],
    },
    leaderboard: ['leaderboard'],
    userRank: (userId) => ['user-rank', userId],

    // ─── User & Preferences ───
    user: {
        preferences: (userId) => ['user-preferences', userId],
    },

    // ─── AI & Knowledge Graph ───
    ai: {
        query: (message) => ['ai', 'query', message],
    },
    knowledge: {
        stats: ['knowledge-stats'],
        cuisines: ['knowledge-cuisines'],
        cuisine: (id) => ['knowledge-cuisine', id],
        cuisinesSemantic: (query) => ['knowledge-cuisines-semantic', query],
        dishes: (cuisineId) => ['knowledge-dishes', cuisineId],
        ingredients: (category) => ['knowledge-ingredients', category],
        vibes: ['knowledge-vibes'],
    },

    // ─── Geo ───
    geo: {
        covers: (geoType) => ['geo-covers', geoType],
    }
}
