'use strict';
/** Recomputes a provider's average rating from visible reviews (SFR-36). `client` = db or transaction client. */
async function recalcProviderRating(client, providerId) {
  await client.query(
    `UPDATE provider_profiles SET
       avg_rating   = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE provider_id = $1 AND is_hidden = FALSE), 0),
       review_count = (SELECT COUNT(*) FROM reviews WHERE provider_id = $1 AND is_hidden = FALSE)
     WHERE provider_id = $1`, [providerId]);
}
module.exports = { recalcProviderRating };
