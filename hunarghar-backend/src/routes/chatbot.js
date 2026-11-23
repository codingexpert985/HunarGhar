'use strict';
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { Validator, str } = require('../utils/validators');
const bot = require('../chatbot/chatbot');
const { searchProviders } = require('../services/providerSearch');

const router = express.Router();

// POST /api/chatbot/message   body: { "message": "I need a tailor in Karachi under 3000" }   (public)
// SFR-44..48 / FR-39..43
router.post('/message', asyncHandler(async (req, res) => {
  const message = str(req.body.message);
  const v = new Validator().required('message', message, 'Message');
  if (message.length > 500) v.add('message', 'Message must be at most 500 characters');
  v.check();

  let result;
  try {
    result = await bot.reply(message, {
      findProviders: async ({ category, city, maxPrice, limit }) => {
        const r = await searchProviders({ category, city, maxPrice: maxPrice ?? undefined, limit, sort: 'rating' });
        return r.providers.map((p) => ({
          provider_id: p.provider_id, name: p.full_name, city: p.city, area: p.area,
          verification_status: p.verification_status, avg_rating: p.avg_rating, min_price: p.min_price,
          profileLink: `/providers/${p.provider_id}`
        }));
      }
    });
  } catch (err) {
    // chatbot unavailable -> useful fallback instead of an error page (SFR-46)
    console.error('[chatbot]', err.message);
    return res.json({ success: true, type: 'fallback', intent: null, confidence: 0,
      reply: 'The assistant is temporarily unavailable. Please use manual search.',
      manualSearch: '/search', disclaimer: bot.DISCLAIMER });
  }
  res.json({ success: true, ...result });
}));

// GET /api/chatbot/info  - model details (handy for the report / demo)
router.get('/info', (req, res) => {
  try {
    const m = bot.loadModel();
    res.json({ success: true, algorithm: 'Multinomial Naive Bayes (unigram+bigram)', intents: m.classes.length, vocabulary: m.vocab.length });
  } catch (e) { res.status(503).json({ success: false, message: e.message }); }
});

module.exports = router;
