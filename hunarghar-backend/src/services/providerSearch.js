'use strict';
const db = require('../config/db');

const SORTS = {
  rating: 'p.avg_rating DESC, p.review_count DESC',
  price_asc: 'min_price ASC NULLS LAST, p.avg_rating DESC',
  price_desc: 'min_price DESC NULLS LAST, p.avg_rating DESC',
  newest: 'u.created_at DESC'
};

/**
 * Search providers. A provider is returned only if she matches ALL chosen filters (SFR-14).
 * Used by GET /api/providers and by the chatbot.
 */
async function searchProviders(opts = {}) {
  const { category, city, minPrice, maxPrice, minRating, verifiedOnly = false } = opts;
  const sort = SORTS[opts.sort] ? opts.sort : 'rating';
  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 12, 1), 50);
  const page = Math.max(parseInt(opts.page, 10) || 1, 1);
  const offset = (page - 1) * limit;

  const params = [];
  const add = (v) => { params.push(v); return '$' + params.length; };

  // conditions on a service row
  const svc = ['s.provider_id = p.provider_id', 's.is_active = TRUE'];
  if (category) svc.push(`LOWER(s.category) = LOWER(${add(category)})`);
  if (minPrice != null) svc.push(`s.price >= ${add(minPrice)}`);
  if (maxPrice != null) svc.push(`s.price <= ${add(maxPrice)}`);
  const svcWhere = svc.join(' AND ');
  const needService = Boolean(category) || minPrice != null || maxPrice != null;

  // conditions on the provider row
  const where = ['u.is_active = TRUE'];
  if (city) {
    const p = add('%' + city + '%');
    where.push(`(p.city ILIKE ${p} OR p.area ILIKE ${p})`);
  }
  if (minRating != null) where.push(`p.avg_rating >= ${add(minRating)}`);
  if (verifiedOnly) where.push(`p.verification_status = 'verified'`);
  if (needService) where.push(`EXISTS (SELECT 1 FROM services s WHERE ${svcWhere})`);
  const whereSql = where.join(' AND ');

  const countRes = await db.query(
    `SELECT COUNT(*) AS total FROM provider_profiles p JOIN users u ON u.user_id = p.provider_id WHERE ${whereSql}`,
    params);

  const limitP = add(limit);
  const offsetP = add(offset);
  const { rows } = await db.query(
    `SELECT u.user_id AS provider_id, u.full_name, p.bio, p.skills, p.city, p.area,
            p.verification_status, p.avg_rating, p.review_count,
            (SELECT MIN(s.price) FROM services s WHERE ${svcWhere}) AS min_price,
            COALESCE((SELECT json_agg(json_build_object(
                 'service_id', s.service_id, 'category', s.category, 'description', s.description,
                 'price', s.price, 'availability', s.availability) ORDER BY s.price)
               FROM services s WHERE ${svcWhere}), '[]'::json) AS services
       FROM provider_profiles p
       JOIN users u ON u.user_id = p.provider_id
      WHERE ${whereSql}
      ORDER BY ${SORTS[sort]}
      LIMIT ${limitP} OFFSET ${offsetP}`,
    params);

  const total = countRes.rows[0].total;
  return { providers: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } };
}

module.exports = { searchProviders };
