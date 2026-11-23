'use strict';
const express = require('express');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { Validator, uuidParam, str } = require('../utils/validators');
const { notFound, badRequest } = require('../utils/AppError');
const { searchProviders } = require('../services/providerSearch');
const { coordsFor } = require('../config/cities');
const { uploader, storeImage } = require('../services/upload');
const { PRICE_MIN, PRICE_MAX, PRICE_MESSAGE } = require('../config/constants');

const router = express.Router();
router.param('id', uuidParam);
router.param('imageId', uuidParam);

const numOrNull = (v) => (v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));

// GET /api/providers?category=&city=&minPrice=&maxPrice=&minRating=&sort=&page=&limit=   (public: SFR-13..15)
router.get('/', asyncHandler(async (req, res) => {
  const q = req.query;
  const minPrice = numOrNull(q.minPrice);
  const maxPrice = numOrNull(q.maxPrice);
  const minRating = numOrNull(q.minRating);
  const outside = (n) => n != null && (n < PRICE_MIN || n > PRICE_MAX);
  if (outside(minPrice) || outside(maxPrice)) throw badRequest(PRICE_MESSAGE);   // price range is fixed: PKR 700 - 9,000
  const v = new Validator();
  if (minPrice != null && minPrice < 0) v.add('minPrice', 'minPrice cannot be negative');
  if (maxPrice != null && minPrice != null && maxPrice < minPrice) v.add('maxPrice', 'maxPrice must be >= minPrice');
  if (minRating != null && (minRating < 0 || minRating > 5)) v.add('minRating', 'minRating must be between 0 and 5');
  v.check();

  const result = await searchProviders({
    category: str(q.category) || undefined,
    city: str(q.city || q.location) || undefined,
    minPrice, maxPrice, minRating,
    verifiedOnly: q.verifiedOnly === 'true',
    sort: q.sort, page: q.page, limit: q.limit
  });
  const empty = result.providers.length === 0;
  res.json({
    success: true, ...result,
    ...(empty ? { message: 'No providers found. Try clearing the filters or use the AI chatbot.',
                  suggestions: ['clear_filters', 'use_chatbot'] } : {})
  });
}));

// GET /api/providers/map  - approximate (city-level) markers only (SFR-17)
router.get('/map', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.user_id AS provider_id, u.full_name, p.city, p.area, p.latitude, p.longitude,
            p.verification_status, p.avg_rating
       FROM provider_profiles p JOIN users u ON u.user_id = p.provider_id
      WHERE u.is_active = TRUE AND p.latitude IS NOT NULL`);
  res.json({ success: true, markers: rows, note: 'Locations are approximate (city level) for privacy.' });
}));

// GET /api/providers/me   - provider's own profile, services, portfolio, verification
router.get('/me', authenticate, requireRole('provider'), asyncHandler(async (req, res) => {
  const id = req.user.user_id;
  const [p, s, i, vr] = await Promise.all([
    db.query(`SELECT u.user_id AS provider_id, u.full_name, u.email, p.bio, p.skills, p.city, p.area,
                     p.verification_status, p.avg_rating, p.review_count
                FROM provider_profiles p JOIN users u ON u.user_id = p.provider_id WHERE p.provider_id = $1`, [id]),
    db.query('SELECT * FROM services WHERE provider_id = $1 AND is_active = TRUE ORDER BY created_at DESC', [id]),
    db.query('SELECT image_id, image_url, created_at FROM portfolio_images WHERE provider_id = $1 ORDER BY created_at DESC', [id]),
    db.query('SELECT request_id, status, submitted_at, reviewed_at, admin_note FROM verification_requests WHERE provider_id = $1 ORDER BY submitted_at DESC LIMIT 1', [id])
  ]);
  res.json({ success: true, profile: p.rows[0], services: s.rows, portfolio: i.rows, latestVerification: vr.rows[0] || null });
}));

// PUT /api/providers/me   - create/update own profile (SFR-08, FR-06)
router.put('/me', authenticate, requireRole('provider'), asyncHandler(async (req, res) => {
  const bio = str(req.body.bio);
  const skills = str(req.body.skills);
  const city = str(req.body.city);
  const area = str(req.body.area);
  const v = new Validator();
  if (bio.length > 2000) v.add('bio', 'Bio must be at most 2000 characters');
  if (city.length > 100 || area.length > 100) v.add('city', 'City/area must be at most 100 characters');
  v.check();
  const { latitude, longitude } = coordsFor(city);   // approximate coordinates only
  const { rows } = await db.query(
    `UPDATE provider_profiles SET bio = $2, skills = $3, city = $4, area = $5, latitude = $6, longitude = $7
      WHERE provider_id = $1
      RETURNING provider_id, bio, skills, city, area, verification_status, avg_rating, review_count`,
    [req.user.user_id, bio || null, skills || null, city || null, area || null, latitude, longitude]);
  res.json({ success: true, message: 'Profile saved', profile: rows[0] });
}));

// POST /api/providers/me/portfolio   multipart field "image"  (SFR-10)
router.post('/me/portfolio', authenticate, requireRole('provider'), uploader.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Please attach an image in the "image" field');
    const count = await db.query('SELECT COUNT(*) AS n FROM portfolio_images WHERE provider_id = $1', [req.user.user_id]);
    if (count.rows[0].n >= 12) throw badRequest('You can upload at most 12 portfolio images');
    let url;
    try { url = await storeImage(req.file); }
    catch (e) { return res.status(502).json({ success: false, message: 'Image upload failed. Please try again.' }); }
    const { rows } = await db.query(
      'INSERT INTO portfolio_images (provider_id, image_url) VALUES ($1,$2) RETURNING image_id, image_url, created_at',
      [req.user.user_id, url]);
    res.status(201).json({ success: true, image: rows[0] });
  }));

// DELETE /api/providers/me/portfolio/:imageId
router.delete('/me/portfolio/:imageId', authenticate, requireRole('provider'), asyncHandler(async (req, res) => {
  const r = await db.query('DELETE FROM portfolio_images WHERE image_id = $1 AND provider_id = $2',
    [req.params.imageId, req.user.user_id]);
  if (!r.rowCount) throw notFound('Image not found');
  res.json({ success: true, message: 'Image removed' });
}));

// GET /api/providers/:id   - public provider profile page data
router.get('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id;
  const p = await db.query(
    `SELECT u.user_id AS provider_id, u.full_name, p.bio, p.skills, p.city, p.area, p.latitude, p.longitude,
            p.verification_status, p.avg_rating, p.review_count
       FROM provider_profiles p JOIN users u ON u.user_id = p.provider_id
      WHERE p.provider_id = $1 AND u.is_active = TRUE`, [id]);
  if (!p.rowCount) throw notFound('Provider not found');
  const [s, img, rev] = await Promise.all([
    db.query('SELECT service_id, category, description, price, availability FROM services WHERE provider_id = $1 AND is_active = TRUE ORDER BY price', [id]),
    db.query('SELECT image_id, image_url FROM portfolio_images WHERE provider_id = $1 ORDER BY created_at DESC', [id]),
    db.query(`SELECT r.review_id, r.rating, r.comment, r.created_at, u.full_name AS customer_name
                FROM reviews r JOIN users u ON u.user_id = r.customer_id
               WHERE r.provider_id = $1 AND r.is_hidden = FALSE ORDER BY r.created_at DESC LIMIT 20`, [id])
  ]);
  res.json({ success: true, provider: p.rows[0], services: s.rows, portfolio: img.rows, reviews: rev.rows });
}));

module.exports = router;
