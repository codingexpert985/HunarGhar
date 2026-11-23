'use strict';
const express = require('express');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { Validator, str } = require('../utils/validators');

const router = express.Router();

// GET /api/categories  (public, SFR-13)
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT category_id, name, description FROM categories ORDER BY name');
  res.json({ success: true, categories: rows });
}));

// POST /api/categories   (admin) - new categories without redesign (adaptability)
router.post('/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const name = str(req.body.name);
  new Validator().required('name', name, 'Category name').check();
  const { rows } = await db.query(
    'INSERT INTO categories (name, description) VALUES ($1,$2) RETURNING category_id, name, description',
    [name.slice(0, 50), str(req.body.description) || null]);
  res.status(201).json({ success: true, category: rows[0] });
}));

module.exports = router;
