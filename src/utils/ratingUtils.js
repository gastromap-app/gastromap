/**
 * Rating Utility for GastroMap
 * Handles the logic of merging seeded Google ratings and internal user reviews.
 */

/**
 * Calculates the final display rating and count for a location.
 * Priority: 
 * 1. If there are internal approved reviews -> use their average.
 * 2. If no internal reviews -> use the seeded 'rating' field (which was Google rating at creation).
 * 3. Fallback to 0.
 * 
 * @param {Object} location - The normalized location object from API
 * @param {Array} reviews - List of approved internal reviews
 * @returns {Object} { rating: number, count: number, isInternal: boolean }
 */
export const getDisplayRating = (location, reviews = []) => {
    // 1. If we have internal reviews, they are the Ground Truth
    const internalReviews = Array.isArray(reviews) 
        ? reviews.filter(r => r.status === 'approved' || r.status === 'published')
        : [];

    if (internalReviews.length > 0) {
        const sum = internalReviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
        const avg = sum / internalReviews.length;
        return {
            rating: Math.round(avg * 10) / 10,
            count: internalReviews.length,
            isInternal: true
        };
    }

    // 2. If no internal reviews, use our 'seeded' rating
    // Note: location.rating is our internal field seeded from Google at creation
    const seededRating = Number(location?.rating || 0);
    const googleCount = Number(location?.google_user_ratings_total || 0);

    if (seededRating > 0) {
        return {
            rating: seededRating,
            count: googleCount, // We show Google count as context since it's a seed
            isInternal: false
        };
    }

    // 3. Absolute fallback
    return {
        rating: 0,
        count: 0,
        isInternal: false
    };
};

/**
 * Helper to get a simple number rating for sorting/filtering
 */
export const getNumericRating = (location, reviews = []) => {
    return getDisplayRating(location, reviews).rating;
};
